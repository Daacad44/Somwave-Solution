import { describe, expect, it } from 'vitest';
import { formatMoney, formatRoleName, hasSeriesValues, kpiTrend, projectProgress } from './metrics';
import { trendFromCounts } from './trend';

describe('dashboard metrics', () => {
  it('formats stored role names for display', () => {
    expect(formatRoleName('SUPER_ADMIN')).toBe('Super Admin');
    expect(formatRoleName('CLIENT')).toBe('Client');
  });

  it('does not invent a trend without a previous baseline', () => {
    expect(trendFromCounts(8, 0)).toBeNull();
    expect(kpiTrend({ value: 8, previous: null })).toBeNull();
    expect(kpiTrend({ value: 8, previous: 4 })).toBe(100);
  });

  it('omits project progress when there are no tasks', () => {
    expect(projectProgress(0, 0)).toBeNull();
    expect(projectProgress(4, 3)).toBe(75);
  });

  it('formats money from real totals', () => {
    expect(formatMoney('1200.00')).toBe('$1,200');
  });

  it('treats all-zero series as empty', () => {
    expect(hasSeriesValues([{ value: 0 }])).toBe(false);
    expect(hasSeriesValues([{ value: 2 }])).toBe(true);
  });
});
