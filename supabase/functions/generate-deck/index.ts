import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import { GoogleGenAI } from 'npm:@google/genai@1.42.0';
import mammoth from 'npm:mammoth@1.11.0';

import { consumeAiQuota, generateDeckFromAi } from '../_shared/aiCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

type AiContentRequest = {
  model: string;
  contents: Array<Record<string, unknown>>;
};

type CreateDeckPayload = {
  userId: number;
  title: string;
  description: string;
  classId: number | string | null;
};

type GeneratedCard = {
  front: string;
  back: string;
  position: number;
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
    const admin = getSupabaseAdmin();
    const { data: user, error } = await admin
      .from('users')
      .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
    }

    const aiLimitsContext = await consumeAiQuota({
      user,
      persistUsage: async ({ count, lastReset }: PersistUsagePayload) => {
        const { error: updateError } = await admin
          .from('users')
          .update({
            ai_generations_count: count,
            last_ai_generation_reset: lastReset.toISOString(),
          })
          .eq('id', authUser.id);

        if (updateError) throw updateError;
      },
    });

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    let aiClient: GoogleGenAI | null = null;

    const result = await generateDeckFromAi({
      userId: authUser.id,
      notes: body.notes,
      file: body.file,
      deckName: body.deckName,
      classId: body.classId,
      aiLimitsContext,
      apiKey,
      parseDocx: async (buffer: Buffer) => {
        const parsed = await mammoth.extractRawText({ buffer });
        return parsed.value;
      },
      generateContent: async ({ model, contents }: AiContentRequest) => {
        aiClient ??= new GoogleGenAI({ apiKey });
        const response = await aiClient.models.generateContent({
          model,
          contents,
          config: {
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        });
        return response.text;
      },
      createDeck: async ({ userId, title, description, classId }: CreateDeckPayload) => {
        const { data, error: createError } = await admin
          .from('decks')
          .insert({
            user_id: userId,
            title,
            description,
            class_id: classId,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        return data;
      },
      insertCards: async (deckId: number, cards: GeneratedCard[]) => {
        const { error: insertError } = await admin
          .from('cards')
          .insert(cards.map((card: GeneratedCard) => ({
            deck_id: deckId,
            front: card.front,
            back: card.back,
            position: card.position,
          })));

        if (insertError) throw insertError;
      },
      deleteDeck: async (deckId: number) => {
        const { error: deleteError } = await admin
          .from('decks')
          .delete()
          .eq('id', deckId)
          .eq('user_id', authUser.id);

        if (deleteError) throw deleteError;
      },
      onParseError: (error: unknown) => {
        console.error('Failed to parse document text:', error);
      },
    });

    return jsonResponse(result, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[generate-deck edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const body: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : 'An unexpected error occurred during AI generation.',
    };

    if (typeof requestError.canWatchAd === 'boolean') {
      body.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(body, { status }, request);
  }
});
