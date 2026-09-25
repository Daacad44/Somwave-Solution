import type { DashboardPeriod, DashboardRange, DashboardTrend } from '@somwave/shared';

/** Display timezone is Africa/Mogadishu (UTC+3, no DST). */
const OFFSET_MS = 3 * 60 * 60 * 1000;

export function zonedYmd(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

export function startOfZonedDay(date: Date): Date {
  const { year, month, day } = zonedYmd(date);
  return new Date(Date.UTC(year, month, day) - OFFSET_MS);
}

export function addZonedDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function ymdKey(date: Date): string {
  const { year, month, day } = zonedYmd(date);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function resolvePeriod(range: DashboardRange, now = new Date()): DashboardPeriod {
  const todayStart = startOfZonedDay(now);
  const end = addZonedDays(todayStart, 1);
  let start: Date;
  if (range === '7d') {
    start = addZonedDays(todayStart, -6);
  } else if (range === '30d') {
    start = addZonedDays(todayStart, -29);
  } else if (range === 'this_year') {
    const { year } = zonedYmd(now);
    start = new Date(Date.UTC(year, 0, 1) - OFFSET_MS);
  } else if (range === 'last_month') {
    const { year, month } = zonedYmd(now);
    start = new Date(Date.UTC(year, month - 1, 1) - OFFSET_MS);
    const thisMonth = new Date(Date.UTC(year, month, 1) - OFFSET_MS);
    const duration = thisMonth.getTime() - start.getTime();
    return {
      start: start.toISOString(),
      end: thisMonth.toISOString(),
      previousStart: new Date(start.getTime() - duration).toISOString(),
      previousEnd: start.toISOString(),
    };
  } else {
    const { year, month } = zonedYmd(now);
    start = new Date(Date.UTC(year, month, 1) - OFFSET_MS);
  }
  const duration = end.getTime() - start.getTime();
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: new Date(start.getTime() - duration).toISOString(),
    previousEnd: start.toISOString(),
  };
}

export function computeTrend(current: number, previous: number): DashboardTrend | null {
  if (previous <= 0) return null;
  return {
    current,
    previous,
    percent: Math.round(((current - previous) / previous) * 100),
  };
}

export function emptySeries(startIso: string, endIso: string): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  let cursor = startOfZonedDay(new Date(startIso));
  const end = new Date(endIso);
  while (cursor.getTime() < end.getTime()) {
    points.push({ date: ymdKey(cursor), value: 0 });
    cursor = addZonedDays(cursor, 1);
  }
  return points;
}

export function bucketByDay(
  dates: readonly Date[],
  startIso: string,
  endIso: string,
): { date: string; value: number }[] {
  const points = emptySeries(startIso, endIso);
  const index = new Map(points.map((point, i) => [point.date, i]));
  for (const date of dates) {
    const key = ymdKey(date);
    const at = index.get(key);
    if (at !== undefined) {
      const point = points[at];
      if (point) point.value += 1;
    }
  }
  return points;
}

export function bucketAmountsByDay(
  rows: readonly { date: Date; amount: number }[],
  startIso: string,
  endIso: string,
): { date: string; value: number }[] {
  const points = emptySeries(startIso, endIso);
  const index = new Map(points.map((point, i) => [point.date, i]));
  for (const row of rows) {
    const key = ymdKey(row.date);
    const at = index.get(key);
    if (at !== undefined) {
      const point = points[at];
      if (point) point.value += row.amount;
    }
  }
  return points.map((point) => ({ ...point, value: Math.round(point.value * 100) / 100 }));
}
