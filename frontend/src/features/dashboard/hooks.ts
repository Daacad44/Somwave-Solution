import { useQuery } from '@tanstack/react-query';
import type { DashboardRange } from '@somwave/shared';
import { fetchDashboard } from './api';

const STALE_TIME = 30_000;

export function useDashboardOverview(range: DashboardRange) {
  return useQuery({
    queryKey: ['dashboard', 'overview', range],
    queryFn: () => fetchDashboard(range),
    staleTime: STALE_TIME,
  });
}

export function useDashboardStats(range: DashboardRange) {
  return useDashboardOverview(range);
}

export function useRecentProjects(range: DashboardRange) {
  return useDashboardOverview(range);
}

export function useRecentTasks(range: DashboardRange) {
  return useDashboardOverview(range);
}

export function useRecentActivity(range: DashboardRange) {
  return useDashboardOverview(range);
}
