import { useQuery } from '@tanstack/react-query';
import type { DashboardRange } from '@somwave/shared';
import { getDashboard } from './api';

const STALE_TIME = 30_000;

export function useDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => getDashboard(range),
    staleTime: STALE_TIME,
  });
}
