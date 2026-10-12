import { apiFetch } from '../../lib/apiClient';

export interface EngineerProfile {
  userId: string;
  headline: string | null;
  skills: string[];
  availability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
  weeklyCapacityHours: string | number;
  timezone: string;
}
export interface AvailabilitySlot {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  kind: 'WORKING' | 'TIME_OFF' | 'ON_CALL';
  note: string | null;
}
export interface TeamEngineer {
  role: string;
  assignedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    engineerProfile: EngineerProfile | null;
    availabilitySlots: AvailabilitySlot[];
  };
  activeTaskCount: number;
  estimatedOpenHours: number;
}
export interface AssignmentEvent {
  id: string;
  userId: string;
  actorId: string;
  action: string;
  role: string;
  occurredAt: string;
}

export const engineerApi = {
  mine: () => apiFetch<EngineerProfile | null>('/engineering/engineers/me/profile'),
  updateMine: (input: {
    headline: string | null;
    skills: string[];
    availability: string;
    weeklyCapacityHours: number;
    timezone: string;
  }) =>
    apiFetch<EngineerProfile>('/engineering/engineers/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  availability: () => apiFetch<AvailabilitySlot[]>('/engineering/engineers/me/availability'),
  addAvailability: (startAt: string, endAt: string, kind: string, note: string) =>
    apiFetch<AvailabilitySlot>('/engineering/engineers/me/availability', {
      method: 'POST',
      body: JSON.stringify({ startAt, endAt, kind, ...(note ? { note } : {}) }),
    }),
  removeAvailability: (id: string) =>
    apiFetch<{ success: boolean }>(`/engineering/engineers/me/availability/${id}`, {
      method: 'DELETE',
    }),
  team: (projectId: string) =>
    apiFetch<TeamEngineer[]>(`/engineering/projects/${projectId}/engineer-profiles`),
  history: (projectId: string) =>
    apiFetch<AssignmentEvent[]>(`/engineering/projects/${projectId}/assignment-history`),
};
