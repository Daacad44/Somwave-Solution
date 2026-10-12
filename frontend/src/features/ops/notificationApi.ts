import { apiFetch } from '../../lib/apiClient';

export interface NotificationPreference {
  eventKey: string;
  inApp: boolean;
  email: boolean;
}

export interface NotificationDelivery {
  id: string;
  channel: string;
  status: string;
  attempts: number;
  sentAt: string | null;
  error: string | null;
  notification: { title: string; createdAt: string };
}

export const NOTIFICATION_EVENTS = [
  'project.assignment',
  'task.assignment',
  'task.review',
  'task.deadline',
  'bug.assignment',
  'bug.critical',
  'github.pr',
  'github.ci',
  'release.approval',
  'deployment.complete',
  'maintenance.schedule',
  'sla.breach',
  'system.update',
] as const;

export const notificationApi = {
  preferences: () => apiFetch<NotificationPreference[]>('/notifications/preferences'),
  deliveries: () => apiFetch<NotificationDelivery[]>('/notifications/deliveries'),
  setPreference: (eventKey: string, inApp: boolean, email: boolean) =>
    apiFetch<NotificationPreference>(`/notifications/preferences/${eventKey}`, {
      method: 'PUT',
      body: JSON.stringify({ inApp, email }),
    }),
};
