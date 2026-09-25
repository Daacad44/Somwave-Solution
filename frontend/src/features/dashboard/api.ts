import type { DashboardOverview, DashboardRange } from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

export function fetchDashboard(range: DashboardRange): Promise<DashboardOverview> {
  const query = new URLSearchParams({ range });
  return apiFetch<DashboardOverview>(`/dashboard?${query.toString()}`);
}
