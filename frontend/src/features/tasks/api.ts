// Tasks feature API (I2.2, §6: features/<feature>/api.ts → apiClient).
import type { AdminTask, CreateTaskInput, UpdateTaskInput, TaskStatus } from '@somwave/shared';
import { apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export interface ListTasksParams {
  page: number;
  pageSize: number;
  projectId?: string;
  status?: TaskStatus;
}

export function listTasks(
  params: ListTasksParams,
): Promise<{ data: AdminTask[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.projectId) query.set('projectId', params.projectId);
  if (params.status) query.set('status', params.status);
  return apiFetchPaged<AdminTask[]>(`/tasks?${query.toString()}`);
}

export function createTask(input: CreateTaskInput): Promise<AdminTask> {
  return apiFetch<AdminTask>('/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<AdminTask> {
  return apiFetch<AdminTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteTask(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
}
