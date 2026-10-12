import { apiFetch } from '../../lib/apiClient';

export interface SystemUpdate {
  id: string;
  title: string;
  status: string;
  category: string;
  productionApprovedAt: string | null;
}
export interface Maintenance {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  assigneeId: string | null;
  resolutionNotes: string | null;
  sla: { responseOverdue: boolean; resolutionOverdue: boolean };
}
export interface Bug {
  id: string;
  title: string;
  severity: string;
  status: string;
  assigneeId: string | null;
  rootCause: string | null;
  sla: { responseOverdue: boolean; resolutionOverdue: boolean };
}
export interface Release {
  id: string;
  version: string;
  notes: string | null;
  status: string;
  approvedAt: string | null;
  rollbackPlan: string | null;
  taskLinks: {
    taskId: string;
    task: {
      id: string;
      title: string;
      githubLinks: { id: string; url: string; title: string | null; state: string | null }[];
    };
  }[];
  pullRequestLinks: { githubTaskLinkId: string; githubTaskLink: ProjectPullRequest }[];
}
export interface ProjectPullRequest {
  id: string;
  url: string;
  title: string | null;
  state: string | null;
  number: number | null;
  repository: { fullName: string };
}
export interface Deployment {
  id: string;
  environment: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

export const operationsApi = {
  updates: (systemId: string) =>
    apiFetch<SystemUpdate[]>(`/engineering/systems/${systemId}/updates`),
  createUpdate: (systemId: string, title: string, category: string) =>
    apiFetch<SystemUpdate>(`/engineering/systems/${systemId}/updates`, {
      method: 'POST',
      body: JSON.stringify({ title, category }),
    }),
  transitionUpdate: (id: string, status: string) =>
    apiFetch<SystemUpdate>(`/engineering/updates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  approveProduction: (id: string) =>
    apiFetch<SystemUpdate>(`/engineering/updates/${id}/production-approval`, { method: 'POST' }),
  bugs: (systemId: string) => apiFetch<Bug[]>(`/engineering/systems/${systemId}/bugs`),
  createBug: (systemId: string, title: string, description: string, severity: string) =>
    apiFetch<Bug>(`/engineering/systems/${systemId}/bugs`, {
      method: 'POST',
      body: JSON.stringify({ title, description, severity, priority: 'MEDIUM' }),
    }),
  updateBug: (id: string, status: string, assigneeId?: string, rootCause?: string) =>
    apiFetch<Bug>(`/engineering/bugs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...(assigneeId ? { assigneeId } : {}),
        ...(rootCause ? { rootCause } : {}),
      }),
    }),
  maintenance: (systemId: string) =>
    apiFetch<Maintenance[]>(`/engineering/systems/${systemId}/maintenance`),
  createMaintenance: (
    systemId: string,
    title: string,
    type: string,
    scheduledAt?: string,
    assigneeId?: string,
    recurrenceRule?: string,
  ) =>
    apiFetch<Maintenance>(`/engineering/systems/${systemId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        type,
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(recurrenceRule ? { recurrenceRule } : {}),
      }),
    }),
  updateMaintenance: (
    id: string,
    status: string,
    options: {
      assigneeId?: string;
      scheduledAt?: string;
      rootCause?: string;
      resolutionNotes?: string;
    },
  ) =>
    apiFetch<Maintenance>(`/engineering/maintenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...options }),
    }),
  releases: (systemId: string) => apiFetch<Release[]>(`/engineering/systems/${systemId}/releases`),
  projectPullRequests: (projectId: string) =>
    apiFetch<ProjectPullRequest[]>(`/engineering/projects/${projectId}/pull-requests`),
  createRelease: (systemId: string, version: string, notes: string, rollbackPlan: string) =>
    apiFetch<Release>(`/engineering/systems/${systemId}/releases`, {
      method: 'POST',
      body: JSON.stringify({ version, notes, rollbackPlan }),
    }),
  linkReleaseTask: (releaseId: string, taskId: string) =>
    apiFetch(`/engineering/releases/${releaseId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    }),
  unlinkReleaseTask: (releaseId: string, taskId: string) =>
    apiFetch(`/engineering/releases/${releaseId}/tasks/${taskId}`, { method: 'DELETE' }),
  linkReleasePullRequest: (releaseId: string, linkId: string) =>
    apiFetch(`/engineering/releases/${releaseId}/pull-requests`, {
      method: 'POST',
      body: JSON.stringify({ linkId }),
    }),
  unlinkReleasePullRequest: (releaseId: string, linkId: string) =>
    apiFetch(`/engineering/releases/${releaseId}/pull-requests/${linkId}`, { method: 'DELETE' }),
  transitionRelease: (id: string, status: string) =>
    apiFetch<Release>(`/engineering/releases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  approveRelease: (id: string) =>
    apiFetch<Release>(`/engineering/releases/${id}/approve`, { method: 'POST' }),
  deployments: (id: string) => apiFetch<Deployment[]>(`/engineering/releases/${id}/deployments`),
  recordDeployment: (
    id: string,
    environment: 'STAGING' | 'PRODUCTION',
    status: 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK',
    notes: string,
  ) =>
    apiFetch<Deployment>(`/engineering/releases/${id}/deployments`, {
      method: 'POST',
      body: JSON.stringify({ environment, status, notes }),
    }),
};
