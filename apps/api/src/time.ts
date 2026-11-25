/**
 * Today's date ('YYYY-MM-DD') in an IANA timezone, worked out in Node rather than Postgres:
 * browsers report legacy names such as 'Asia/Calcutta' that ICU accepts but Postgres's tz
 * database may not. Always pass timezones through here, never into SQL.
 */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
