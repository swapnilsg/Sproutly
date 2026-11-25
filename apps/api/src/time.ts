/**
 * Today's date ('YYYY-MM-DD') in an IANA timezone, worked out in Node rather than Postgres:
 * browsers report legacy names such as 'Asia/Calcutta' that ICU accepts but Postgres's tz
 * database may not. Always pass timezones through here, never into SQL.
 */
export function todayIn(timeZone: string, now = new Date()): string {
  // Assemble from parts rather than relying on any locale's date pattern.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
