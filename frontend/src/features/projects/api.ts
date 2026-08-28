// Projects feature API (I2.1, §6: features/<feature>/api.ts → apiClient).
import type {
  AdminProject,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStatus,
} from '@somwave/shared';
import { apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export interface ListProjectsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProjectStatus;
}

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

export function createProject(input: CreateProjectInput): Promise<AdminProject> {
  return apiFetch<AdminProject>('/projects', { method: 'POST', body: JSON.stringify(input) });
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<AdminProject> {
  return apiFetch<AdminProject>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' });
}
