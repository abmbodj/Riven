const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const buildInsertPayload = ({
  userId,
  title,
  formatVersion,
  guideData,
  studyState,
  content,
  noteId,
  classId,
  sourceIds,
}) => ({
  user_id: userId,
  title,
  format_version: formatVersion,
  guide_data: guideData,
  study_state: studyState,
  content,
  note_id: noteId,
  class_id: classId,
  ...sourceIdsPatch(sourceIds),
});

const buildUpdatePayload = ({
  title,
  formatVersion,
  guideData,
  studyState,
  content,
  noteId,
  classId,
  sourceIds,
}) => ({
  title,
  format_version: formatVersion,
  guide_data: guideData,
  study_state: studyState,
  content,
  note_id: noteId,
  class_id: classId,
  ...sourceIdsPatch(sourceIds),
});

// RAG sources the session was generated from (tutor-chat retrieves from these). Omitted when
// empty so the full_context path never writes the column.
const sourceIdsPatch = (sourceIds) => (Array.isArray(sourceIds) && sourceIds.length ? { source_ids: sourceIds } : {});

export const persistGeneratedStudyGuide = async ({
  admin,
  userId,
  title,
  formatVersion,
  guideData,
  studyState,
  content,
  noteId,
  classId,
  replaceGuideId = null,
  sourceIds = /** @type {string[]} */ ([]),
}) => {
  if (replaceGuideId) {
    const { data: existingGuide, error: loadError } = await admin
      .from('study_guides')
      .select('id')
      .eq('id', replaceGuideId)
      .eq('user_id', userId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!existingGuide) {
      throw createHttpError('Guide not found.', 404);
    }

    const { data: updatedGuide, error: updateError } = await admin
      .from('study_guides')
      .update(buildUpdatePayload({
        title,
        formatVersion,
        guideData,
        studyState,
        content,
        noteId,
        classId,
        sourceIds,
      }))
      .eq('id', replaceGuideId)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (updateError) throw updateError;
    return updatedGuide;
  }

  const { data: createdGuide, error: createError } = await admin
    .from('study_guides')
    .insert(buildInsertPayload({
      userId,
      title,
      formatVersion,
      guideData,
      studyState,
      content,
      noteId,
      classId,
      sourceIds,
    }))
    .select('id')
    .single();

  if (createError) throw createError;
  return createdGuide;
};
