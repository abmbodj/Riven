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
}) => ({
  user_id: userId,
  title,
  format_version: formatVersion,
  guide_data: guideData,
  study_state: studyState,
  content,
  note_id: noteId,
  class_id: classId,
});

const buildUpdatePayload = ({
  title,
  formatVersion,
  guideData,
  studyState,
  content,
  noteId,
  classId,
}) => ({
  title,
  format_version: formatVersion,
  guide_data: guideData,
  study_state: studyState,
  content,
  note_id: noteId,
  class_id: classId,
});

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
    }))
    .select('id')
    .single();

  if (createError) throw createError;
  return createdGuide;
};
