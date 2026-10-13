const DAY_MS = 86_400_000;

export interface CapacityTask {
  startDate: Date | null;
  dueDate: Date | null;
  estimatedHours: number;
}

export interface CapacitySlot {
  startAt: Date;
  endAt: Date;
  kind: string;
}

function mondayUtc(date: Date): number {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return day - ((date.getUTCDay() + 6) % 7) * DAY_MS;
}

export function calculateWeeklyCapacity(
  tasks: CapacityTask[],
  slots: CapacitySlot[],
  weeklyCapacityHours: number,
  availability: string,
  now = new Date(),
) {
  const firstWeek = mondayUtc(now);
  return Array.from({ length: 4 }, (_, index) => {
    const weekStart = firstWeek + index * 7 * DAY_MS;
    const weekEnd = weekStart + 7 * DAY_MS;
    const estimatedHours = tasks.reduce((total, task) => {
      const start = task.startDate?.getTime() ?? task.dueDate?.getTime() ?? firstWeek;
      const end = task.dueDate?.getTime() ?? task.startDate?.getTime() ?? firstWeek;
      const from = Math.min(start, end);
      const until = Math.max(start, end) + DAY_MS;
      const overlap = Math.max(0, Math.min(until, weekEnd) - Math.max(from, weekStart));
      return total + task.estimatedHours * (overlap / Math.max(DAY_MS, until - from));
    }, 0);
    const timeOffDays = new Set<number>();
    for (const slot of slots.filter((row) => row.kind === 'TIME_OFF')) {
      for (let day = weekStart; day < weekStart + 5 * DAY_MS; day += DAY_MS) {
        if (slot.startAt.getTime() < day + DAY_MS && slot.endAt.getTime() > day)
          timeOffDays.add(day);
      }
    }
    const base = availability === 'UNAVAILABLE' ? 0 : weeklyCapacityHours;
    const availableHours = Math.max(0, base * (1 - timeOffDays.size / 5));
    return {
      weekStart: new Date(weekStart).toISOString().slice(0, 10),
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      availableHours: Math.round(availableHours * 10) / 10,
      overbooked: estimatedHours > availableHours,
    };
  });
}
