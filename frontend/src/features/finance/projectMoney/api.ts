import type { ProjectMoneyDetail, ProjectMoneyOverview, ProjectMoneyQuery } from '@somwave/shared';
import { apiDownload, apiFetch } from '../../../lib/apiClient';

export type ProjectMoneyFilters = Partial<ProjectMoneyQuery>;

function query(filters: ProjectMoneyFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const projectMoneyApi = {
  overview: (filters: ProjectMoneyFilters) =>
    apiFetch<ProjectMoneyOverview>(`/finance/projects-money${query(filters)}`),
  detail: (projectId: string) =>
    apiFetch<ProjectMoneyDetail>(`/finance/projects-money/${encodeURIComponent(projectId)}`),
  exportCsv: (filters: ProjectMoneyFilters) =>
    apiDownload(`/finance/projects-money.csv${query(filters)}`, 'somwave-projects-money.csv'),
};

export const projectMoneyKeys = {
  overview: (filters: ProjectMoneyFilters) => ['finance-projects-money', filters] as const,
  detail: (projectId: string) => ['finance-project-money', projectId] as const,
};
