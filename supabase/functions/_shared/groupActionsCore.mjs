export const createHttpError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const GROUP_FILE_PUBLIC_PREFIX = '/storage/v1/object/public/group-files/';

const defaultGenerateJoinCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(3));

  return `RIV-${Array.from(bytes, (value) => chars[value % chars.length]).join('')}`;
};

export const ensureUniqueJoinCode = async ({
  generateCode = defaultGenerateJoinCode,
  isCodeTaken,
  maxAttempts = 20,
}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateCode();
    if (!(await isCodeTaken(candidate))) {
      return candidate;
    }
  }

  throw createHttpError('Failed to generate a unique group code', 500);
};

export const extractGroupFileStoragePath = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  if (!fileUrl.includes(GROUP_FILE_PUBLIC_PREFIX)) return null;

  const [, rawPath] = fileUrl.split(GROUP_FILE_PUBLIC_PREFIX);
  if (!rawPath) return null;

  return rawPath.split('?')[0] || null;
};

const requireNonEmptyString = (value, message) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createHttpError(message, 400);
  }

  return value.trim();
};

const requireGroupMember = async (
  loadMembership,
  groupId,
  userId,
  errorMessage = 'Not a member of this group',
  status = 403,
) => {
  const membership = await loadMembership(groupId, userId);
  if (!membership) {
    throw createHttpError(errorMessage, status);
  }

  return membership;
};

const requireGroupAdmin = async (loadMembership, groupId, userId) => {
  const membership = await loadMembership(groupId, userId);
  if (!membership || membership.role !== 'admin') {
    throw createHttpError('Admin permission required', 403);
  }

  return membership;
};

export const createGroupAction = async ({
  actorId,
  name,
  classId,
  isActorBanned,
  isCodeTaken,
  createGroup,
  addMember,
  cleanupGroup,
  generateCode,
}) => {
  const trimmedName = requireNonEmptyString(name, 'Group name is required');

  if (await isActorBanned(actorId)) {
    throw createHttpError('Your account has been restricted from creating study groups.', 403);
  }

  const joinCode = await ensureUniqueJoinCode({ generateCode, isCodeTaken });
  let newGroup = null;

  try {
    newGroup = await createGroup({
      name: trimmedName,
      classId: classId || null,
      joinCode,
      createdBy: actorId,
    });

    await addMember(newGroup.id, actorId, 'admin');
  } catch (error) {
    if (newGroup?.id && typeof cleanupGroup === 'function') {
      try {
        await cleanupGroup(newGroup.id);
      } catch {
        // Ignore cleanup failures and surface the original error.
      }
    }

    throw error;
  }

  return {
    ...newGroup,
    member_count: 1,
    role: 'admin',
  };
};

export const updateGroupAction = async ({
  actorId,
  groupId,
  name,
  classId,
  hasClassId,
  regenerateCode,
  loadMembership,
  loadGroup,
  updateGroup,
  isCodeTaken,
  generateCode,
}) => {
  await requireGroupAdmin(loadMembership, groupId, actorId);

  const existingGroup = await loadGroup(groupId);
  if (!existingGroup) {
    throw createHttpError('Group not found', 404);
  }

  let nextJoinCode;
  if (regenerateCode) {
    nextJoinCode = await ensureUniqueJoinCode({ generateCode, isCodeTaken });
  }

  const nextName = name === undefined ? existingGroup.name : requireNonEmptyString(name, 'Group name is required');
  const nextClassId = hasClassId ? (classId || null) : existingGroup.class_id ?? null;

  return updateGroup(groupId, {
    name: nextName,
    class_id: nextClassId,
    ...(nextJoinCode ? { join_code: nextJoinCode } : {}),
  });
};

export const deleteGroupAction = async ({
  actorId,
  groupId,
  loadMembership,
  deleteGroup,
}) => {
  await requireGroupAdmin(loadMembership, groupId, actorId);
  await deleteGroup(groupId);
  return { message: 'Group deleted successfully' };
};

export const joinGroupAction = async ({
  actorId,
  joinCode,
  isActorBanned,
  loadGroupByCode,
  loadMembership,
  addMember,
}) => {
  const formattedCode = requireNonEmptyString(joinCode, 'Join code is required').toUpperCase();

  if (await isActorBanned(actorId)) {
    throw createHttpError('Your account has been restricted from joining study groups.', 403);
  }

  const group = await loadGroupByCode(formattedCode);
  if (!group) {
    throw createHttpError('Invalid join code', 404);
  }

  const existingMembership = await loadMembership(group.id, actorId);
  if (existingMembership) {
    throw createHttpError('You are already a member of this group', 400, { group });
  }

  await addMember(group.id, actorId, 'member');

  return {
    message: 'Successfully joined group',
    group: {
      id: group.id,
      name: group.name,
    },
  };
};

export const leaveGroupAction = async ({
  actorId,
  groupId,
  loadMembership,
  countAdmins,
  countMembers,
  deleteGroup,
  removeMembership,
}) => {
  const membership = await loadMembership(groupId, actorId);
  if (!membership) {
    throw createHttpError('Not a member of this group', 404);
  }

  if (membership.role === 'admin') {
    const adminCount = await countAdmins(groupId);

    if (Number(adminCount) === 1) {
      const memberCount = await countMembers(groupId);

      if (Number(memberCount) > 1) {
        throw createHttpError('You must promote another admin before leaving, or delete the group.', 400);
      }

      await deleteGroup(groupId);
      return { message: 'Group deleted as the last member left' };
    }
  }

  await removeMembership(groupId, actorId);
  return { message: 'Left group successfully' };
};

export const removeGroupMemberAction = async ({
  actorId,
  groupId,
  targetUserId,
  loadMembership,
  loadTargetMembership,
  removeMembership,
}) => {
  await requireGroupAdmin(loadMembership, groupId, actorId);

  if (String(actorId) === String(targetUserId)) {
    throw createHttpError('Use the leave endpoint to remove yourself', 400);
  }

  const targetMembership = await loadTargetMembership(groupId, targetUserId);
  if (!targetMembership) {
    throw createHttpError('User is not a member of this group', 404);
  }

  await removeMembership(groupId, targetUserId);
  return { message: 'User removed successfully' };
};

export const shareDeckToGroupAction = async ({
  actorId,
  groupId,
  deckId,
  loadMembership,
  loadDeck,
  loadSharedDeck,
  addSharedDeck,
}) => {
  await requireGroupMember(loadMembership, groupId, actorId);

  const deck = await loadDeck(deckId);
  if (!deck) {
    throw createHttpError('Deck not found', 404);
  }

  if (Number(deck.user_id) !== Number(actorId)) {
    throw createHttpError('You must own a deck to share it', 403);
  }

  const existingShare = await loadSharedDeck(groupId, deckId);
  if (existingShare) {
    throw createHttpError('Deck is already shared in this group', 400);
  }

  await addSharedDeck(groupId, deckId, actorId);
  return { message: 'Deck shared successfully' };
};

export const removeSharedDeckAction = async ({
  actorId,
  groupId,
  deckId,
  loadMembership,
  loadSharedDeck,
  deleteSharedDeck,
}) => {
  const membership = await requireGroupMember(loadMembership, groupId, actorId);
  const sharedDeck = await loadSharedDeck(groupId, deckId);

  if (!sharedDeck) {
    throw createHttpError('Deck not found in this group', 404);
  }

  if (membership.role !== 'admin' && Number(sharedDeck.shared_by) !== Number(actorId)) {
    throw createHttpError('Only group admins or the original sharer can remove this deck', 403);
  }

  await deleteSharedDeck(groupId, deckId);
  return { message: 'Deck removed from group' };
};

export const createGroupFolderAction = async ({
  actorId,
  groupId,
  name,
  loadMembership,
  createFolder,
}) => {
  await requireGroupMember(loadMembership, groupId, actorId, 'Not a member', 403);
  const trimmedName = requireNonEmptyString(name, 'Folder name required');
  return createFolder(groupId, trimmedName, actorId);
};

export const renameGroupFolderAction = async ({
  actorId,
  groupId,
  folderId,
  name,
  loadMembership,
  loadFolder,
  renameFolder,
}) => {
  const membership = await requireGroupMember(loadMembership, groupId, actorId, 'Not a member', 403);
  const folder = await loadFolder(folderId, groupId);

  if (!folder) {
    throw createHttpError('Folder not found', 404);
  }

  if (membership.role !== 'admin' && Number(folder.created_by) !== Number(actorId)) {
    throw createHttpError('Only admins or the creator can rename this folder', 403);
  }

  const trimmedName = requireNonEmptyString(name, 'Folder name required');
  return renameFolder(folderId, trimmedName);
};

export const deleteGroupFolderAction = async ({
  actorId,
  groupId,
  folderId,
  loadMembership,
  deleteFolder,
}) => {
  const membership = await requireGroupMember(loadMembership, groupId, actorId, 'Not a member', 403);

  if (membership.role !== 'admin') {
    throw createHttpError('Only admins can delete folders', 403);
  }

  await deleteFolder(folderId, groupId);
  return { message: 'Folder deleted' };
};

export const uploadGroupFileAction = async ({
  actorId,
  groupId,
  payload,
  loadMembership,
  createFile,
}) => {
  await requireGroupMember(loadMembership, groupId, actorId, 'Not a member', 403);

  if (!payload?.name || !payload?.file_url || !payload?.file_type) {
    throw createHttpError('Missing file metadata', 400);
  }

  return createFile(groupId, {
    name: payload.name,
    file_url: payload.file_url,
    file_type: payload.file_type,
    folder_id: payload.folder_id || null,
    uploaded_by: actorId,
  });
};

export const deleteGroupFileAction = async ({
  actorId,
  groupId,
  fileId,
  loadMembership,
  loadFile,
  deleteStorageFile,
  deleteFile,
}) => {
  const membership = await requireGroupMember(loadMembership, groupId, actorId, 'Not a member', 403);
  const file = await loadFile(fileId, groupId);

  if (!file) {
    throw createHttpError('File not found', 404);
  }

  if (membership.role !== 'admin' && Number(file.uploaded_by) !== Number(actorId)) {
    throw createHttpError('Only admins or the uploader can delete this file', 403);
  }

  const storagePath = extractGroupFileStoragePath(file.file_url);
  if (storagePath) {
    await deleteStorageFile?.(storagePath);
  }

  await deleteFile(fileId, groupId);
  return { message: 'File deleted' };
};
