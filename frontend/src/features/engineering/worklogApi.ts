import { apiFetch } from '../../lib/apiClient';

export interface ActiveTaskTimer {
  id: string;
  taskId: string;
  startedAt: string;
  task: { id: string; title: string; projectId: string };
}

export interface ProgressReport {
  id: string;
  authorId: string;
  period: 'DAILY' | 'WEEKLY';
  periodStart: string;
  status: string;
  completedWork: string;
  inProgressWork: string | null;
  blockers: string | null;
  nextPlannedWork: string | null;
  milestoneProgress: string | null;
  priorities: string | null;
  hoursWorkedMinutes: number;
  reviewNote: string | null;
  author: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
}

export interface ProgressReportInput {
  period: 'DAILY' | 'WEEKLY';
  periodStart: string;
  completedWork: string;
  inProgressWork?: string;
  blockers?: string;
  nextPlannedWork?: string;
  milestoneProgress?: string;
  priorities?: string;
}

export const worklogApi = {
  activeTimer: () => apiFetch<ActiveTaskTimer | null>('/engineering/timers/active'),
  startTimer: (taskId: string) =>
    apiFetch<ActiveTaskTimer>(`/engineering/tasks/${taskId}/timer/start`, { method: 'POST' }),
  stopTimer: (note?: string) =>
    apiFetch<{ timerId: string; entry: { id: string; minutes: number } }>(
      '/engineering/timers/active/stop',
      { method: 'POST', body: JSON.stringify({ ...(note ? { note } : {}) }) },
    ),
  discardTimer: (reason: string) =>
    apiFetch<{ id: string; stoppedAt: string }>('/engineering/timers/active/discard', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  reports: (projectId: string) =>
    apiFetch<ProgressReport[]>(`/engineering/projects/${projectId}/progress-reports`),
  createReport: (projectId: string, input: ProgressReportInput) =>
    apiFetch<ProgressReport>(`/engineering/projects/${projectId}/progress-reports`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  reviewReport: (id: string, status: 'REVIEWED' | 'CLARIFICATION_REQUESTED', note: string) =>
    apiFetch<ProgressReport>(`/engineering/progress-reports/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
};
