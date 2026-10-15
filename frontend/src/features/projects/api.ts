// Projects feature API (I2.1, §6: features/<feature>/api.ts → apiClient).
import type {
  AdminProject,
  CreateProjectInput,
  ProjectStatus,
  ProjectWorkspace,
  ProjectPortfolio,
  ProjectFinance,
  CreateProjectExpenseInput,
  ReviseProjectBudgetInput,
  ProjectActivity,
  UpdateProjectInput,
  UpdateProjectHealthNoteInput,
} from '@somwave/shared';
import { apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export interface ListProjectsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProjectStatus;
}

export interface PortfolioFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  priority?: string;
  managerId?: string;
  engineerId?: string;
  clientId?: string;
  health?: string;
  dueFrom?: string;
  dueTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export function getProjectPortfolio(filters: PortfolioFilters): Promise<ProjectPortfolio> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return apiFetch<ProjectPortfolio>(`/projects/portfolio?${query.toString()}`);
}

export const projectFinanceApi = {
  get: (projectId: string) => apiFetch<ProjectFinance>(`/projects/${projectId}/finance`),
  createExpense: (projectId: string, input: CreateProjectExpenseInput) =>
    apiFetch<{ id: string }>(`/projects/${projectId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  removeExpense: (projectId: string, expenseId: string) =>
    apiFetch<{ success: boolean }>(`/projects/${projectId}/expenses/${expenseId}`, {
      method: 'DELETE',
    }),
  reviseBudget: (projectId: string, input: ReviseProjectBudgetInput) =>
    apiFetch<{ id: string; budget: string }>(`/projects/${projectId}/budget-revisions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export const getProjectActivity = (projectId: string) =>
  apiFetch<ProjectActivity>(`/projects/${projectId}/activity`);

export function listProjects(
  params: ListProjectsParams,
): Promise<{ data: AdminProject[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  return apiFetchPaged<AdminProject[]>(`/projects?${query.toString()}`);
}

export function getProjectWorkspace(id: string): Promise<ProjectWorkspace> {
  return apiFetch<ProjectWorkspace>(`/projects/${id}/workspace`);
}

export function createProject(input: CreateProjectInput): Promise<AdminProject> {
  return apiFetch<AdminProject>('/projects', { method: 'POST', body: JSON.stringify(input) });
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<AdminProject> {
  return apiFetch<AdminProject>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateProjectHealthNote(
  id: string,
  input: UpdateProjectHealthNoteInput,
): Promise<{ note: string | null }> {
  return apiFetch<{ note: string | null }>(`/projects/${id}/health-note`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' });
}
