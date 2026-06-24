import { getRelativeTime } from '../time';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const ago = (ms: number) => Date.now() - ms;

describe('getRelativeTime', () => {
  it('returns "just now" within the last minute', () => {
    expect(getRelativeTime(ago(10_000))).toBe('just now');
  });

  it('formats minutes (singular + plural)', () => {
    expect(getRelativeTime(ago(1 * MINUTE + 1000))).toBe('1 minute ago');
    expect(getRelativeTime(ago(5 * MINUTE))).toBe('5 minutes ago');
  });

  it('formats hours', () => {
    expect(getRelativeTime(ago(1 * HOUR + 1000))).toBe('1 hour ago');
    expect(getRelativeTime(ago(2 * HOUR))).toBe('2 hours ago');
  });

  it('calls one day ago "yesterday" and uses days within a week', () => {
    expect(getRelativeTime(ago(DAY + HOUR))).toBe('yesterday');
    expect(getRelativeTime(ago(3 * DAY))).toBe('3 days ago');
  });

  it('formats weeks past a week', () => {
    expect(getRelativeTime(ago(2 * WEEK))).toBe('2 weeks ago');
  });

  it('falls back to a calendar date for older timestamps', () => {
    // ~3 months ago → not one of the relative phrases
    const result = getRelativeTime(ago(90 * DAY));
    expect(result).not.toMatch(/ago|yesterday|just now/);
  });

  it('accepts a Date as well as epoch ms', () => {
    expect(getRelativeTime(new Date(ago(2 * HOUR)))).toBe('2 hours ago');
  });
});
