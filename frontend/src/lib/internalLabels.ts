import type { MilestoneStatus, ProjectStatus } from '@somwave/shared';

// Internal management copy. Portal and website keep their own locale.
export const INTERNAL_PROJECT_STATUS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const INTERNAL_MILESTONE_STATUS: Record<MilestoneStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};
