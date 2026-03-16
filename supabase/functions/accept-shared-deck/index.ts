import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { acceptSharedDeckCore } from '../_shared/acceptSharedDeckCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type SharedDeckRecord = {
  title: string;
  description: string | null;
};

type SharedDeckCard = {
  front: string;
  back: string;
  front_image: string | null;
  back_image: string | null;
  position: number;
};

const parseMessageId = (value: unknown) => {
  const messageId = Number(value);

  if (!Number.isInteger(messageId) || messageId <= 0) {
    const error = new Error('messageId must be a valid id');
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  return messageId;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const authUser = await resolveSupabaseUser(request);
    const messageId = parseMessageId(body.messageId);
    const admin = getSupabaseAdmin();

    const result = await acceptSharedDeckCore({
      messageId,
      receiverId: authUser.id,
      loadMessageForReceiver: async (targetMessageId: number, targetUserId: number) => {
        const { data, error } = await admin
          .from('messages')
          .select('id, receiver_id, message_type, deck_data')
          .eq('id', targetMessageId)
          .eq('receiver_id', targetUserId)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
      loadDeck: async (deckId: number) => {
        const { data, error } = await admin
          .from('decks')
          .select('id, title, description')
          .eq('id', deckId)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
      loadDeckCards: async (deckId: number) => {
        const { data, error } = await admin
          .from('cards')
          .select('front, back, front_image, back_image, position')
          .eq('deck_id', deckId)
          .order('position', { ascending: true });

        if (error) throw error;
        return data || [];
      },
      loadDeckTags: async (deckId: number) => {
        const { data, error } = await admin
          .from('deck_tags')
          .select('tag_id')
          .eq('deck_id', deckId);

        if (error) throw error;
        return ((data || []) as Array<{ tag_id: unknown }>).map((row) => Number(row.tag_id));
      },
      createDeck: async (userId: number, originalDeck: SharedDeckRecord) => {
        const { data, error } = await admin
          .from('decks')
          .insert({
            user_id: userId,
            title: originalDeck.title,
            description: originalDeck.description,
          })
          .select('*')
          .single();

        if (error) throw error;
        return data;
      },
      insertDeckCards: async (newDeckId: number, cards: SharedDeckCard[]) => {
        const { error } = await admin
          .from('cards')
          .insert(cards.map((card: SharedDeckCard) => ({
            deck_id: newDeckId,
            front: card.front,
            back: card.back,
            front_image: card.front_image,
            back_image: card.back_image,
            position: card.position,
          })));

        if (error) throw error;
      },
      insertDeckTags: async (newDeckId: number, tagIds: number[]) => {
        const { error } = await admin
          .from('deck_tags')
          .insert(tagIds.map((tagId: number) => ({
            deck_id: newDeckId,
            tag_id: tagId,
          })));

        if (error) throw error;
      },
      updateMessageDeckData: async (targetMessageId: number, deckData: Record<string, unknown>) => {
        const { error } = await admin
          .from('messages')
          .update({ deck_data: JSON.stringify(deckData) })
          .eq('id', targetMessageId);

        if (error) throw error;
      },
    });

    return jsonResponse(result, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[accept-shared-deck edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
      request,
    );
  }
});
