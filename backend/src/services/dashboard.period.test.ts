import { describe, expect, it } from 'vitest';
import {
  bucketByDay,
  computeTrend,
  resolvePeriod,
  startOfZonedDay,
  ymdKey,
} from './dashboard.period';

describe('dashboard period', () => {
  it('builds a 7-day window in Africa/Mogadishu', () => {
    const now = new Date('2026-09-25T10:00:00.000Z');
    const period = resolvePeriod('7d', now);
    expect(period.start).toBe(startOfZonedDay(new Date('2026-09-19T00:00:00.000Z')).toISOString());
    expect(new Date(period.end).getTime()).toBeGreaterThan(new Date(period.start).getTime());
  });

  it('omits a trend when the previous period has no data', () => {
    expect(computeTrend(8, 0)).toBeNull();
    expect(computeTrend(8, 4)).toEqual({ current: 8, previous: 4, percent: 100 });
  });

  it('buckets dates onto calendar days without inventing values', () => {
    const start = '2026-09-20T21:00:00.000Z';
    const end = '2026-09-23T21:00:00.000Z';
    const series = bucketByDay([new Date('2026-09-21T08:00:00.000Z')], start, end);
    expect(
      series.every(
        (point) => point.value === 0 || point.date === ymdKey(new Date('2026-09-21T08:00:00.000Z')),
      ),
    ).toBe(true);
    expect(series.reduce((sum, point) => sum + point.value, 0)).toBe(1);
  });
});
