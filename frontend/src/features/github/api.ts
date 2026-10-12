import { apiFetch } from '../../lib/apiClient';

export const ACTIVITY_KINDS = [
  'commits',
  'branches',
  'issues',
  'pulls',
  'runs',
  'contributors',
  'releases',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface Installation {
  id: string;
  installationId: string;
  accountLogin: string;
  status: string;
  _count: { repositories: number };
}

export interface Repository {
  id: string;
  fullName: string;
  defaultBranch: string | null;
  isPrivate: boolean;
  projectId: string | null;
  installationId: string;
}

export interface Activity {
  id: string;
  title: string;
  url: string | null;
  state: string | null;
  actor: string | null;
  createdAt: string | null;
  additions: number | null;
}

export const githubApi = {
  installations: () => apiFetch<Installation[]>('/github/installations'),
  connect: (installationId: string) =>
    apiFetch('/github/installations', { method: 'POST', body: JSON.stringify({ installationId }) }),
  disconnect: (id: string) => apiFetch(`/github/installations/${id}`, { method: 'DELETE' }),
  repositories: () => apiFetch<Repository[]>('/github/repositories'),
  map: (id: string, projectId: string | null) =>
    apiFetch(`/github/repositories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectId }),
    }),
  activity: (id: string, kind: ActivityKind) =>
    apiFetch<Activity[]>(`/github/repositories/${id}/activity/${kind}`),
};
