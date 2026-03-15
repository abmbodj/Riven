import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  endGroupSessionAction,
  joinGroupSessionAction,
  respondToGroupSessionCardAction,
  startGroupSessionAction,
} from '../_shared/groupSessionsCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const requireId = (value: unknown, label: string) => {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!normalized) {
    const error = new Error(`${label} is required`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  return normalized;
};

const requirePositiveInt = (value: unknown, label: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${label} must be a valid id`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  return parsed;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const action = body.action;
    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    const loadMembership = async (groupId: string, userId: number) => {
      const { data, error } = await admin
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    };

    const loadSession = async (sessionId: string) => {
      const { data, error } = await admin
        .from('cram_sessions')
        .select('id, group_id, deck_id, started_by, started_at, ended_at, status')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    };

    if (action === 'session-start') {
      const result = await startGroupSessionAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        deckId: requirePositiveInt(body.deckId, 'deckId'),
        loadMembership,
        loadSharedDeck: async (groupId: string, deckId: number) => {
          const { data, error } = await admin
            .from('group_decks')
            .select('deck_id')
            .eq('group_id', groupId)
            .eq('deck_id', deckId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        createSession: async ({
          groupId,
          deckId,
          startedBy,
        }: {
          groupId: string;
          deckId: number;
          startedBy: number;
        }) => {
          const { data, error } = await admin
            .from('cram_sessions')
            .insert({
              group_id: groupId,
              deck_id: deckId,
              started_by: startedBy,
            })
            .select('*')
            .single();

          if (error) throw error;
          return data;
        },
      });

      return jsonResponse(result, { status: 201 });
    }

    if (action === 'session-join') {
      const result = await joinGroupSessionAction({
        actorId: authUser.id,
        sessionId: requireId(body.sessionId, 'sessionId'),
        loadSession,
        loadMembership,
      });

      return jsonResponse(result);
    }

    if (action === 'session-respond') {
      const result = await respondToGroupSessionCardAction({
        actorId: authUser.id,
        sessionId: requireId(body.sessionId, 'sessionId'),
        cardId: requirePositiveInt(body.cardId, 'cardId'),
        knewIt: body.knewIt,
        loadSession,
        loadMembership,
        upsertResponse: async ({
          sessionId,
          userId,
          cardId,
          knewIt,
        }: {
          sessionId: string;
          userId: number;
          cardId: number;
          knewIt: boolean;
        }) => {
          const { error } = await admin
            .from('cram_responses')
            .upsert({
              session_id: sessionId,
              user_id: userId,
              card_id: cardId,
              knew_it: knewIt,
              responded_at: new Date().toISOString(),
            }, {
              onConflict: 'session_id,user_id,card_id',
            });

          if (error) throw error;
        },
      });

      return jsonResponse(result);
    }

    if (action === 'session-end') {
      const result = await endGroupSessionAction({
        actorId: authUser.id,
        sessionId: requireId(body.sessionId, 'sessionId'),
        loadSession,
        loadMembership,
        endSession: async (sessionId: string) => {
          const { error } = await admin
            .from('cram_sessions')
            .update({
              status: 'ended',
              ended_at: new Date().toISOString(),
            })
            .eq('id', sessionId);

          if (error) throw error;
        },
      });

      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[group-sessions edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
    );
  }
});
