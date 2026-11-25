import { describe, expect, it } from 'vitest';
import { isTimeZone, todayIn } from './time.js';

describe('todayIn', () => {
  // 20:00 UTC on 1 Jan is already 2 Jan in India and still 1 Jan in New York.
  const evening = new Date('2026-01-01T20:00:00Z');

  it('gives the local date in the user’s timezone', () => {
    expect(todayIn('Asia/Kolkata', evening)).toBe('2026-01-02');
    expect(todayIn('America/New_York', evening)).toBe('2026-01-01');
    expect(todayIn('UTC', evening)).toBe('2026-01-01');
  });

  it('understands legacy names such as Asia/Calcutta', () => {
    expect(todayIn('Asia/Calcutta', evening)).toBe('2026-01-02');
  });
});

describe('isTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isTimeZone('Europe/London')).toBe(true);
    expect(isTimeZone('Asia/Calcutta')).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});
