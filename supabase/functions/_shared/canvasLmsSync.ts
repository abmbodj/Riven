import nodeIcal from 'npm:node-ical@0.25.4';

import { syncCanvasCalendar } from './canvasLmsCore.mjs';

type CanvasAssignment = {
  title: string;
  description: string;
  dueDateIso: string | null;
  status: string;
  uid: string;
  canvasCourseId: string | null;
};

type SupabaseAdminClient = {
  from: (table: string) => any;
};

type CanvasClassRow = {
  id: number | string;
  name: string;
  created_at?: string | null;
  canvas_course_id?: string | null;
  created?: boolean;
};

const ical = nodeIcal as typeof nodeIcal & {
  async?: {
    parseICS?: (data: string) => Promise<Record<string, unknown>>;
  };
};

export const parseCanvasCalendar = async (icalUrl: string) => {
  const response = await fetch(icalUrl);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return await ical.async?.parseICS?.(text);
};

export const syncCanvasCalendarForUser = async ({
  admin,
  userId,
  icalUrl,
  now = new Date(),
}: {
  admin: SupabaseAdminClient;
  userId: number;
  icalUrl: string;
  now?: Date;
}) => {
  let events;
  try {
    events = await parseCanvasCalendar(icalUrl);
  } catch (error) {
    const feedError = error instanceof Error ? error : new Error(String(error));
    (feedError as Error & { isCanvasFeedError?: boolean }).isCanvasFeedError = true;
    throw feedError;
  }

  const classSelect = 'id, name, created_at, canvas_course_id';
  const fetchClassByCanvasCourseId = async (canvasCourseId: string): Promise<CanvasClassRow | null> => {
    const { data, error } = await admin
      .from('classes')
      .select(classSelect)
      .eq('user_id', userId)
      .eq('canvas_course_id', canvasCourseId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  };

  const [
    { data: existingClasses, error: classesError },
    { data: existingAssignments, error: assignmentsError },
  ] = await Promise.all([
    admin
      .from('classes')
      .select(classSelect)
      .eq('user_id', userId),
    admin
      .from('assignments')
      .select('canvas_assignment_id, class_id')
      .eq('user_id', userId)
      .not('canvas_assignment_id', 'is', null),
  ]);

  if (classesError) throw classesError;
  if (assignmentsError) throw assignmentsError;

  const syncedAssignments = (existingAssignments || []) as Array<{
    canvas_assignment_id: string | null;
    class_id: number | string | null;
  }>;

  return await syncCanvasCalendar({
    userId,
    now,
    events: events || {},
    existingClasses: existingClasses || [],
    existingAssignments: syncedAssignments,
    createClass: async (typedUserId: number | string, courseName: string, canvasCourseId: string | null) => {
      const { data, error } = await admin
        .from('classes')
        .insert({
          user_id: typedUserId,
          name: courseName,
          color: '#4f46e5',
          canvas_course_id: canvasCourseId,
        })
        .select(classSelect)
        .single();

      if (!error) {
        return {
          ...data,
          created: true,
        };
      }

      if (typeof error === 'object' && error && 'code' in error && error.code === '23505' && canvasCourseId) {
        const existingClass = await fetchClassByCanvasCourseId(canvasCourseId);
        if (existingClass) {
          return {
            ...existingClass,
            created: false,
          };
        }
      }

      throw error;
    },
    linkClassToCanvasCourse: async (classId: number | string, canvasCourseId: string) => {
      const { data, error } = await admin
        .from('classes')
        .update({ canvas_course_id: canvasCourseId })
        .eq('id', classId)
        .is('canvas_course_id', null)
        .select(classSelect)
        .maybeSingle();

      if (!error && data) {
        return data;
      }

      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        const existingClass = await fetchClassByCanvasCourseId(canvasCourseId);
        if (existingClass) {
          return existingClass;
        }
      }

      if (error) throw error;

      const { data: existingClassById, error: existingClassByIdError } = await admin
        .from('classes')
        .select(classSelect)
        .eq('id', classId)
        .maybeSingle();

      if (existingClassByIdError) throw existingClassByIdError;
      return existingClassById || null;
    },
    createAssignment: async (
      typedUserId: number | string,
      classId: number | string,
      assignment: CanvasAssignment,
    ) => {
      const { error } = await admin
        .from('assignments')
        .insert({
          user_id: typedUserId,
          class_id: classId,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.dueDateIso,
          status: assignment.status,
          canvas_assignment_id: assignment.uid,
        });

      if (!error) {
        return { inserted: true };
      }

      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        return { inserted: false };
      }

      throw error;
    },
  });
};
