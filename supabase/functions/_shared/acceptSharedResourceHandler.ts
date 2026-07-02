import { acceptSharedResourceCore } from './acceptSharedDeckCore.mjs';
import { resolveSupabaseUser } from './auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from './http.ts';
import { checkRateLimit } from './rateLimit.ts';
import { getSupabaseAdmin } from './supabaseAdmin.ts';

type SharedDeckRecord = {
  id: number;
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

type SharedNoteRecord = {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
  enhanced_content: Record<string, unknown> | null;
};

type SharedGuideRecord = {
  id: string;
  title: string;
  format_version: number | null;
  guide_data: Record<string, unknown> | null;
  study_state: Record<string, unknown> | null;
  content: Record<string, unknown> | null;
};

type NewNotePayload = {
  title: string;
  content: Record<string, unknown> | null;
  enhanced_content: null;
  class_id: null;
  audio_url: null;
  audio_duration_seconds: null;
  source_type: 'import';
};

type NewGuidePayload = {
  title: string;
  format_version: number;
  guide_data: Record<string, unknown> | null;
  study_state: Record<string, unknown>;
  content: Record<string, unknown> | null;
  note_id: null;
  class_id: null;
};

const EMPTY_RICH_TEXT_DOC = { type: 'doc', content: [] };

const extractRichText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  if (!Array.isArray(record.content)) return '';

  return record.content.map(extractRichText).filter(Boolean).join(' ');
};

const normalizeRichTextDoc = (value: unknown): Record<string, unknown> => {
  if (
    value
    && typeof value === 'object'
    && (value as Record<string, unknown>).type === 'doc'
    && Array.isArray((value as Record<string, unknown>).content)
  ) {
    return value as Record<string, unknown>;
  }

  const text = extractRichText(value).replace(/\s+/g, ' ').trim();
  if (!text) return { ...EMPTY_RICH_TEXT_DOC, content: [] };

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
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

export const handleAcceptSharedResourceRequest = async (request: Request) => {
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

    const result = await acceptSharedResourceCore({
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
        return data as SharedDeckRecord | null;
      },
      loadDeckCards: async (deckId: number) => {
        const { data, error } = await admin
          .from('cards')
          .select('front, back, front_image, back_image, position')
          .eq('deck_id', deckId)
          .order('position', { ascending: true });

        if (error) throw error;
        return (data || []) as SharedDeckCard[];
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
      loadNote: async (noteId: string) => {
        const { data, error } = await admin
          .from('notes')
          .select('id, title, content, enhanced_content')
          .eq('id', noteId)
          .maybeSingle();

        if (error) throw error;
        return data as SharedNoteRecord | null;
      },
      createNote: async (userId: number, note: NewNotePayload) => {
        const { data, error } = await admin
          .from('notes')
          .insert({
            user_id: userId,
            title: note.title,
            content: normalizeRichTextDoc(note.content),
            enhanced_content: null,
            class_id: null,
            audio_url: null,
            audio_duration_seconds: null,
            source_type: 'import',
          })
          .select('*')
          .single();

        if (error) throw error;
        return data;
      },
      loadGuide: async (guideId: string) => {
        const { data, error } = await admin
          .from('study_guides')
          .select('id, title, format_version, guide_data, study_state, content')
          .eq('id', guideId)
          .maybeSingle();

        if (error) throw error;
        return data as SharedGuideRecord | null;
      },
      createGuide: async (userId: number, guide: NewGuidePayload) => {
        const { data, error } = await admin
          .from('study_guides')
          .insert({
            user_id: userId,
            title: guide.title,
            format_version: guide.format_version,
            guide_data: guide.guide_data,
            study_state: guide.study_state,
            content: guide.content || {},
            note_id: null,
            class_id: null,
          })
          .select('*')
          .single();

        if (error) throw error;
        return data;
      },
      updateMessageSharedData: async (targetMessageId: number, sharedData: Record<string, unknown>) => {
        const { error } = await admin
          .from('messages')
          .update({ deck_data: JSON.stringify(sharedData) })
          .eq('id', targetMessageId);

        if (error) throw error;
      },
    });

    return jsonResponse(result, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[accept-shared-resource edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
      request,
    );
  }
};
