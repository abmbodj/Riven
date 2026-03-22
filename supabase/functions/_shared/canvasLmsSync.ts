import nodeIcal from 'npm:node-ical@0.25.4';

import { syncCanvasCalendar } from './canvasLmsCore.mjs';

type CanvasAssignment = {
  title: string;
  description: string;
  dueDateIso: string | null;
  status: string;
  uid: string;
};

type SupabaseAdminClient = {
  from: (table: string) => any;
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

  const [
    { data: existingClasses, error: classesError },
    { data: existingAssignments, error: assignmentsError },
  ] = await Promise.all([
    admin
      .from('classes')
      .select('id, name')
      .eq('user_id', userId),
    admin
      .from('assignments')
      .select('canvas_assignment_id')
      .eq('user_id', userId)
      .not('canvas_assignment_id', 'is', null),
  ]);

  if (classesError) throw classesError;
  if (assignmentsError) throw assignmentsError;

  const syncedAssignments = (existingAssignments || []) as Array<{
    canvas_assignment_id: string | null;
  }>;

  return await syncCanvasCalendar({
    userId,
    now,
    events: events || {},
    existingClasses: existingClasses || [],
    existingAssignmentIds: syncedAssignments.map((assignment) => assignment.canvas_assignment_id),
    createClass: async (typedUserId: number, courseName: string) => {
      const { data, error } = await admin
        .from('classes')
        .insert({
          user_id: typedUserId,
          name: courseName,
          color: '#4f46e5',
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    createAssignment: async (
      typedUserId: number,
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
