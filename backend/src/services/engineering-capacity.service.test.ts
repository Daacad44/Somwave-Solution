import { describe, expect, it } from 'vitest';
import { calculateWeeklyCapacity } from './engineering-capacity.service';

describe('weekly engineer capacity', () => {
  it('spreads scheduled work across weeks and flags a week over capacity', () => {
    const weeks = calculateWeeklyCapacity(
      [
        {
          startDate: new Date('2026-10-12T00:00:00Z'),
          dueDate: new Date('2026-10-25T00:00:00Z'),
          estimatedHours: 100,
        },
      ],
      [],
      40,
      'AVAILABLE',
      new Date('2026-10-12T00:00:00Z'),
    );
    expect(weeks[0]?.estimatedHours).toBeGreaterThan(40);
    expect(weeks[1]?.estimatedHours).toBeGreaterThan(40);
    expect(weeks[0]?.overbooked).toBe(true);
    expect(weeks[2]?.estimatedHours).toBe(0);
  });

  it('reduces available hours for time off in the selected week', () => {
    const weeks = calculateWeeklyCapacity(
      [],
      [
        {
          startAt: new Date('2026-10-12T00:00:00Z'),
          endAt: new Date('2026-10-14T00:00:00Z'),
          kind: 'TIME_OFF',
        },
      ],
      40,
      'AVAILABLE',
      new Date('2026-10-12T00:00:00Z'),
    );
    expect(weeks[0]?.availableHours).toBe(24);
    expect(weeks[1]?.availableHours).toBe(40);
  });
});
