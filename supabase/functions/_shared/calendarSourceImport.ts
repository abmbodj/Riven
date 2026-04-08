import nodeIcal from 'npm:node-ical@0.25.4';

const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;

const ical = nodeIcal as typeof nodeIcal & {
  async?: {
    parseICS?: (data: string) => Promise<Record<string, unknown>>;
  };
};

type SupabaseAdminClient = {
  from: (table: string) => any;
};

type ImportCalendarSourceOptions = {
  admin: SupabaseAdminClient;
  userId: string | number;
  sourceId: string;
  icsText: string;
  replaceExisting?: boolean;
  now?: Date;
};

export async function parseCalendarIcsText(icsText: string) {
  return (await ical.async?.parseICS?.(icsText)) ?? {};
}

export async function importCalendarSourceEvents({
  admin,
  userId,
  sourceId,
  icsText,
  replaceExisting = false,
  now = new Date(),
}: ImportCalendarSourceOptions) {
  const events = await parseCalendarIcsText(icsText);

  if (replaceExisting) {
    const { error: deleteError } = await admin
      .from('assignments')
      .delete()
      .eq('user_id', userId)
      .eq('calendar_source_id', sourceId);

    if (deleteError) throw deleteError;
  }

  const existingUids = new Set<string>();

  if (!replaceExisting) {
    const { data: existingRows, error: existingError } = await admin
      .from('assignments')
      .select('canvas_assignment_id')
      .eq('user_id', userId)
      .eq('calendar_source_id', sourceId)
      .not('canvas_assignment_id', 'is', null);

    if (existingError) throw existingError;

    (existingRows || []).forEach((row: { canvas_assignment_id?: string | null }) => {
      if (row.canvas_assignment_id) existingUids.add(row.canvas_assignment_id);
    });
  }

  const toInsert: Array<Record<string, unknown>> = [];

  for (const key in events) {
    const event = events[key] as Record<string, unknown>;
    if (event.type !== 'VEVENT') continue;

    const uid = event.uid as string | undefined;
    if (!uid || existingUids.has(uid)) continue;

    const summary = (event.summary as string | undefined) ?? 'Untitled Event';
    const description = (event.description as string | undefined) ?? '';
    const rawDue = (event.end ?? event.start) as Date | string | undefined;
    if (!rawDue) continue;

    const parsedDue = rawDue instanceof Date ? rawDue : new Date(String(rawDue));
    if (Number.isNaN(parsedDue.getTime())) continue;

    const daysPastDue = (now.getTime() - parsedDue.getTime()) / (1000 * 60 * 60 * 24);
    const status = daysPastDue > 7 ? 'Archived' : 'Todo';
    const assignmentType = EXAM_PATTERN.test(summary) ? 'exam' : 'assignment';

    toInsert.push({
      user_id: userId,
      title: summary,
      description,
      due_date: parsedDue.toISOString(),
      status,
      assignment_type: assignmentType,
      calendar_source_id: sourceId,
      canvas_assignment_id: uid,
    });

    existingUids.add(uid);
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await admin
      .from('assignments')
      .insert(toInsert);

    if (insertError && insertError.code !== '23505') throw insertError;
  }

  const { error: updateError } = await admin
    .from('calendar_sources')
    .update({ last_synced_at: now.toISOString() })
    .eq('id', sourceId);

  if (updateError) throw updateError;

  return { eventsAdded: toInsert.length };
}
