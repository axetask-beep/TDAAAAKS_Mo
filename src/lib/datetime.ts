// Ports AXETASKS/src/lib/datetime.ts verbatim. Combines a Date's calendar
// date and clock time into an absolute ISO string, so it round-trips
// unambiguously through the server's `timestamp` columns regardless of
// server timezone.
export function combineDateAndTime(date: Date | null, time: Date | null): string | undefined {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const hh = time ? time.getHours() : 0;
  const mm = time ? time.getMinutes() : 0;
  return new Date(y, m, d, hh, mm, 0).toISOString();
}

export function isoToDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}
