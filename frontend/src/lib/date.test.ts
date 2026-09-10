import { describe, it, expect } from 'vitest';
import { formatDate, toDateInputValue } from './date';

describe('formatDate', () => {
  it('formats a UTC instant in Africa/Mogadishu as a calendar date', () => {
    expect(formatDate('2026-09-10T21:30:00.000Z')).toBe('2026-09-11');
  });

  it('returns an em dash for empty values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('toDateInputValue', () => {
  it('returns yyyy-MM-dd for a date input', () => {
    expect(toDateInputValue('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
  });

  it('returns empty string when missing', () => {
    expect(toDateInputValue(null)).toBe('');
  });
});
