// Milestones feature API (I2.3, §6: features/<feature>/api.ts → apiClient).
import type {
  AdminMilestone,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  MilestoneStatus,
  MilestoneDependencyRecord,
} from '@somwave/shared';
import { apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export interface ListMilestonesParams {
  page: number;
  pageSize: number;
  projectId?: string;
  status?: MilestoneStatus;
}

export function listMilestones(
  params: ListMilestonesParams,
): Promise<{ data: AdminMilestone[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.projectId) query.set('projectId', params.projectId);
  if (params.status) query.set('status', params.status);
  return apiFetchPaged<AdminMilestone[]>(`/milestones?${query.toString()}`);
}

export function createMilestone(input: CreateMilestoneInput): Promise<AdminMilestone> {
  return apiFetch<AdminMilestone>('/milestones', { method: 'POST', body: JSON.stringify(input) });
}

export function updateMilestone(id: string, input: UpdateMilestoneInput): Promise<AdminMilestone> {
  return apiFetch<AdminMilestone>(`/milestones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteMilestone(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/milestones/${id}`, { method: 'DELETE' });
}

export function listMilestoneDependencies(id: string): Promise<MilestoneDependencyRecord[]> {
  return apiFetch<MilestoneDependencyRecord[]>(`/milestones/${id}/dependencies`);
}
export function addMilestoneDependency(
  id: string,
  dependsOnId: string,
): Promise<MilestoneDependencyRecord> {
  return apiFetch<MilestoneDependencyRecord>(`/milestones/${id}/dependencies`, {
    method: 'POST',
    body: JSON.stringify({ dependsOnId }),
  });
}
export function removeMilestoneDependency(
  id: string,
  dependsOnId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/milestones/${id}/dependencies/${dependsOnId}`, {
    method: 'DELETE',
  });
}
