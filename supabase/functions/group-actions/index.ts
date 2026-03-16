import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  createGroupAction,
  createGroupFolderAction,
  createHttpError,
  deleteGroupAction,
  deleteGroupFileAction,
  deleteGroupFolderAction,
  joinGroupAction,
  leaveGroupAction,
  removeGroupMemberAction,
  removeSharedDeckAction,
  renameGroupFolderAction,
  shareDeckToGroupAction,
  updateGroupAction,
  uploadGroupFileAction,
} from '../_shared/groupActionsCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createGroupSchema, joinGroupSchema } from '../_shared/validation.ts';

type CreateGroupPayload = {
  name: string;
  classId: number | string | null;
  joinCode: string;
  createdBy: number;
};

const generateJoinCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(3));

  return `RIV-${Array.from(bytes, (value) => chars[value % chars.length]).join('')}`;
};

const requireId = (value: unknown, label: string) => {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!normalized) {
    throw createHttpError(`${label} is required`, 400);
  }

  return normalized;
};

const requirePositiveInt = (value: unknown, label: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(`${label} must be a valid id`, 400);
  }

  return parsed;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (!['POST', 'PUT', 'DELETE'].includes(request.method)) {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    const loadUserBanState = async (userId: number) => {
      const { data, error } = await admin
        .from('users')
        .select('is_banned')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data?.is_banned);
    };

    const loadGroupMembership = async (groupId: string, userId: number) => {
      const { data, error } = await admin
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    };

    const countGroupMembers = async (groupId: string, role?: string) => {
      let query = admin
        .from('group_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('group_id', groupId);

      if (role) {
        query = query.eq('role', role);
      }

      const { count, error } = await query;
      if (error) throw error;
      return Number(count ?? 0);
    };

    if (request.method === 'POST' && action === 'group-create') {
      const createParsed = createGroupSchema.safeParse(body);
      if (!createParsed.success) {
        return jsonResponse(
          { error: createParsed.error.errors[0]?.message ?? 'Invalid group data' },
          { status: 400 },
          request
        );
      }
      const result = await createGroupAction({
        actorId: authUser.id,
        name: createParsed.data.name,
        classId: createParsed.data.class_id ?? undefined,
        isActorBanned: loadUserBanState,
        isCodeTaken: async (joinCode: string) => {
          const { data, error } = await admin
            .from('study_groups')
            .select('id')
            .eq('join_code', joinCode)
            .maybeSingle();

          if (error) throw error;
          return Boolean(data?.id);
        },
        createGroup: async ({ name, classId, joinCode, createdBy }: CreateGroupPayload) => {
          const { data, error } = await admin
            .from('study_groups')
            .insert({
              name,
              class_id: classId,
              join_code: joinCode,
              created_by: createdBy,
            })
            .select('*')
            .single();

          if (error) throw error;
          return data;
        },
        addMember: async (groupId: string, userId: number, role: string) => {
          const { error } = await admin
            .from('group_members')
            .insert({
              group_id: groupId,
              user_id: userId,
              role,
            });

          if (error) throw error;
        },
        cleanupGroup: async (groupId: string) => {
          const { error } = await admin
            .from('study_groups')
            .delete()
            .eq('id', groupId);

          if (error) throw error;
        },
        generateCode: generateJoinCode,
      });

      return jsonResponse(result, { status: 201 }, request);
    }

    if (request.method === 'PUT' && action === 'group-update') {
      const result = await updateGroupAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        name: body.name,
        classId: body.class_id,
        hasClassId: Object.prototype.hasOwnProperty.call(body, 'class_id'),
        regenerateCode: body.regenerate_code === true,
        loadMembership: loadGroupMembership,
        loadGroup: async (groupId: string) => {
          const { data, error } = await admin
            .from('study_groups')
            .select('*')
            .eq('id', groupId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        updateGroup: async (groupId: string, updates: Record<string, unknown>) => {
          const { data, error } = await admin
            .from('study_groups')
            .update(updates)
            .eq('id', groupId)
            .select('*')
            .single();

          if (error) throw error;
          return data;
        },
        isCodeTaken: async (joinCode: string) => {
          const { data, error } = await admin
            .from('study_groups')
            .select('id')
            .eq('join_code', joinCode)
            .maybeSingle();

          if (error) throw error;
          return Boolean(data?.id);
        },
        generateCode: generateJoinCode,
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'DELETE' && action === 'group-delete') {
      const result = await deleteGroupAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        loadMembership: loadGroupMembership,
        deleteGroup: async (groupId: string) => {
          const { error } = await admin
            .from('study_groups')
            .delete()
            .eq('id', groupId);

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'POST' && action === 'group-join') {
      const joinParsed = joinGroupSchema.safeParse(body);
      if (!joinParsed.success) {
        return jsonResponse(
          { error: joinParsed.error.errors[0]?.message ?? 'Invalid join data' },
          { status: 400 },
          request
        );
      }
      const result = await joinGroupAction({
        actorId: authUser.id,
        joinCode: joinParsed.data.join_code,
        isActorBanned: loadUserBanState,
        loadGroupByCode: async (joinCode: string) => {
          const { data, error } = await admin
            .from('study_groups')
            .select('id, name')
            .eq('join_code', joinCode)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        loadMembership: loadGroupMembership,
        addMember: async (groupId: string, userId: number, role: string) => {
          const { error } = await admin
            .from('group_members')
            .insert({
              group_id: groupId,
              user_id: userId,
              role,
            });

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'DELETE' && action === 'group-leave') {
      const result = await leaveGroupAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        loadMembership: loadGroupMembership,
        countAdmins: async (groupId: string) => countGroupMembers(groupId, 'admin'),
        countMembers: async (groupId: string) => countGroupMembers(groupId),
        deleteGroup: async (groupId: string) => {
          const { error } = await admin
            .from('study_groups')
            .delete()
            .eq('id', groupId);

          if (error) throw error;
        },
        removeMembership: async (groupId: string, userId: number) => {
          const { error } = await admin
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'DELETE' && action === 'group-member-remove') {
      const result = await removeGroupMemberAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        targetUserId: requirePositiveInt(body.userId, 'userId'),
        loadMembership: loadGroupMembership,
        loadTargetMembership: loadGroupMembership,
        removeMembership: async (groupId: string, userId: number) => {
          const { error } = await admin
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', userId);

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'POST' && action === 'group-deck-share') {
      const result = await shareDeckToGroupAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        deckId: requirePositiveInt(body.deck_id, 'deck_id'),
        loadMembership: loadGroupMembership,
        loadDeck: async (deckId: number) => {
          const { data, error } = await admin
            .from('decks')
            .select('id, user_id')
            .eq('id', deckId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
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
        addSharedDeck: async (groupId: string, deckId: number, userId: number) => {
          const { error } = await admin
            .from('group_decks')
            .insert({
              group_id: groupId,
              deck_id: deckId,
              shared_by: userId,
            });

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'DELETE' && action === 'group-deck-remove') {
      const result = await removeSharedDeckAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        deckId: requirePositiveInt(body.deckId, 'deckId'),
        loadMembership: loadGroupMembership,
        loadSharedDeck: async (groupId: string, deckId: number) => {
          const { data, error } = await admin
            .from('group_decks')
            .select('shared_by')
            .eq('group_id', groupId)
            .eq('deck_id', deckId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        deleteSharedDeck: async (groupId: string, deckId: number) => {
          const { error } = await admin
            .from('group_decks')
            .delete()
            .eq('group_id', groupId)
            .eq('deck_id', deckId);

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'POST' && action === 'group-folder-create') {
      const result = await createGroupFolderAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        name: body.name,
        loadMembership: loadGroupMembership,
        createFolder: async (groupId: string, name: string, userId: number) => {
          const { data, error } = await admin
            .from('group_folders')
            .insert({
              group_id: groupId,
              name,
              created_by: userId,
            })
            .select('*')
            .single();

          if (error) throw error;
          return data;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'PUT' && action === 'group-folder-update') {
      const result = await renameGroupFolderAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        folderId: requireId(body.folderId, 'folderId'),
        name: body.name,
        loadMembership: loadGroupMembership,
        loadFolder: async (folderId: string, groupId: string) => {
          const { data, error } = await admin
            .from('group_folders')
            .select('created_by')
            .eq('id', folderId)
            .eq('group_id', groupId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        renameFolder: async (folderId: string, name: string) => {
          const { data, error } = await admin
            .from('group_folders')
            .update({ name })
            .eq('id', folderId)
            .select('*')
            .single();

          if (error) throw error;
          return data;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'DELETE' && action === 'group-folder-delete') {
      const result = await deleteGroupFolderAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        folderId: requireId(body.folderId, 'folderId'),
        loadMembership: loadGroupMembership,
        deleteFolder: async (folderId: string, groupId: string) => {
          const { error } = await admin
            .from('group_folders')
            .delete()
            .eq('id', folderId)
            .eq('group_id', groupId);

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'POST' && action === 'group-file-upload') {
      const result = await uploadGroupFileAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        payload: body,
        loadMembership: loadGroupMembership,
        createFile: async (groupId: string, filePayload: Record<string, unknown>) => {
          const { data, error } = await admin
            .from('group_files')
            .insert({
              group_id: groupId,
              folder_id: filePayload.folder_id,
              name: filePayload.name,
              file_url: filePayload.file_url,
              file_type: filePayload.file_type,
              uploaded_by: filePayload.uploaded_by,
            })
            .select('*')
            .single();

          if (error) throw error;
          return data;
        },
      });

      return jsonResponse(result, {}, request);
    }

    if (request.method === 'DELETE' && action === 'group-file-delete') {
      const result = await deleteGroupFileAction({
        actorId: authUser.id,
        groupId: requireId(body.groupId, 'groupId'),
        fileId: requireId(body.fileId, 'fileId'),
        loadMembership: loadGroupMembership,
        loadFile: async (fileId: string, groupId: string) => {
          const { data, error } = await admin
            .from('group_files')
            .select('uploaded_by, file_url')
            .eq('id', fileId)
            .eq('group_id', groupId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        deleteStorageFile: async (storagePath: string) => {
          const { error } = await admin.storage.from('group-files').remove([storagePath]);
          if (error) {
            console.warn('[group-actions edge function] storage cleanup failed', error.message);
          }
        },
        deleteFile: async (fileId: string, groupId: string) => {
          const { error } = await admin
            .from('group_files')
            .delete()
            .eq('id', fileId)
            .eq('group_id', groupId);

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[group-actions edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
      request,
    );
  }
});
