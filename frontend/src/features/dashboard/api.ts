import type { DashboardPayload, DashboardRange } from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

export function getDashboard(range: DashboardRange): Promise<DashboardPayload> {
  const query = new URLSearchParams({ range });
  return apiFetch<DashboardPayload>(`/dashboard?${query.toString()}`);
}
