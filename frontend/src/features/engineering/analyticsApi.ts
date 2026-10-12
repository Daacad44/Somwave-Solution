import { apiFetch } from '../../lib/apiClient';

export interface MonthlyCount {
  month: string;
  count: number;
}
export interface EngineeringAnalytics {
  projectProgress: {
    projectId: string;
    name: string;
    total: number;
    done: number;
    percent: number;
  }[];
  engineerWorkload: {
    userId: string;
    name: string;
    activeTasks: number;
    estimatedHours: number;
    weeklyCapacityHours: number;
  }[];
  taskCompletion: MonthlyCount[];
  bugTrends: MonthlyCount[];
  releaseFrequency: MonthlyCount[];
  maintenancePerformance: { month: string; total: number; completed: number; onTime: number }[];
  slaCompliance: { total: number; onTime: number; percent: number };
}

export const analyticsApi = {
  load: () => apiFetch<EngineeringAnalytics>('/engineering/analytics'),
};
