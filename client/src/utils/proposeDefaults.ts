/**
 * Default start for a proposed study session: `hour`:00 on `day`, or — when that moment
 * has already passed — the next `hour`:00 after `now`. The propose sheet rejects start
 * times in the past, so a default must never be one (health audit #16).
 */
export function nextUpcomingAt(day: Date, hour: number, now: Date = new Date()): Date {
  const candidate = new Date(day);
  candidate.setHours(hour, 0, 0, 0);
  if (candidate.getTime() > now.getTime()) return candidate;

  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
