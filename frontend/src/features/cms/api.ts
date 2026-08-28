// CMS feature API (W4, §6: features/<feature>/api.ts → apiClient).
import type { AdminService, CreateServiceInput, UpdateServiceInput } from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

export function listServices(): Promise<AdminService[]> {
  return apiFetch<AdminService[]>('/cms/services');
}

export function createService(input: CreateServiceInput): Promise<AdminService> {
  return apiFetch<AdminService>('/cms/services', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateService(id: string, input: UpdateServiceInput): Promise<AdminService> {
  return apiFetch<AdminService>(`/cms/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteService(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/cms/services/${id}`, { method: 'DELETE' });
}
