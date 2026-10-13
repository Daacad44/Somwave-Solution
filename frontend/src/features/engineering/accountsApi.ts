import { apiFetch } from '../../lib/apiClient';

export type EngineerAccountStatus =
  | 'INVITED'
  | 'PENDING_VERIFICATION'
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export interface EngineerAccountProfile {
  status: EngineerAccountStatus;
  phone: string | null;
  jobTitle: string | null;
  specialization: string | null;
  skills: string[];
  experienceLevel: string | null;
  employmentType: string | null;
  weeklyCapacityHours: number | string;
  availability: string;
}

export interface EngineerAccount {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  activeProjects?: number;
  projectIds?: string[];
  assignedTasks?: number;
  workloadHours?: number | string;
  taskStatuses?: string[];
  lastActivity?: string | null;
  profile: EngineerAccountProfile;
  engineerAccountInvitation?: {
    status: string;
    deliveryStatus: string;
    expiresAt: string | null;
    lastSentAt: string | null;
    verifiedAt: string | null;
    activatedAt: string | null;
  } | null;
}

export interface EngineerAccountInput {
  name: string;
  email: string;
  phone?: string;
  jobTitle: string;
  specialization: string;
  skills: string[];
  experienceLevel: 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  weeklyCapacityHours: number;
  availability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
}

export interface EngineerActivity {
  id: string;
  action: string;
  createdAt?: string;
  occurredAt?: string;
  actorId?: string | null;
  subjectType?: string;
}

export interface EngineeringTeamOverview {
  totalEngineers: number;
  activeEngineers: number;
  pendingInvitations: number;
  pendingProjectAcceptances: number;
  availableEngineers: number;
  engineersAtCapacity: number;
  totalAssignedProjects: number;
  activeEngineeringTasks: number;
  overdueTasks: number;
  projectsAtRisk: number;
}

const base = '/engineering/accounts';

export const accountsApi = {
  overview: () => apiFetch<EngineeringTeamOverview>('/engineering/team-overview'),
  list: () => apiFetch<EngineerAccount[]>(base),
  detail: (id: string) => apiFetch<EngineerAccount>(`${base}/${id}`),
  activity: (id: string) => apiFetch<EngineerActivity[]>(`${base}/${id}/activity`),
  create: (input: EngineerAccountInput) =>
    apiFetch<EngineerAccount>(base, { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<Omit<EngineerAccountInput, 'email'>>) =>
    apiFetch<EngineerAccount>(`${base}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  action: (id: string, action: 'resend' | 'cancel' | 'suspend' | 'reactivate') =>
    apiFetch<EngineerAccount>(`${base}/${id}/${action}`, { method: 'POST' }),
};
