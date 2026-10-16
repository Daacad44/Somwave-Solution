import { apiDownload, apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export interface ReportDefinition {
  key: string;
  label: string;
  category: string;
  description: string;
  permission?: string;
  filters?: string[];
  statusOptions?: string[];
}

export interface ReportPeriod {
  from: string;
  to: string;
  timezone: string;
}

export interface ReportOverview {
  period: ReportPeriod;
  generatedAt: string;
  metrics: Record<string, number | string | null | Array<Record<string, unknown>>>;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export type ReportRow = Record<string, string | number | boolean | null | undefined> & {
  href?: string;
};

export interface ReportResult {
  key: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: Record<string, string | number | null>;
  period: ReportPeriod;
  generatedAt: string;
}

export interface ReportFilters {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  projectId?: string;
  clientId?: string;
  engineerId?: string;
}

function queryString(filters: Partial<ReportFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export const reportsApi = {
  catalog: () => apiFetch<{ reports: ReportDefinition[] }>('/reports/catalog'),
  overview: (from: string, to: string) =>
    apiFetch<ReportOverview>(`/reports/overview?${queryString({ from, to })}`),
  report: (
    key: string,
    filters: ReportFilters,
  ): Promise<{ data: ReportResult; meta: PaginationMeta }> =>
    apiFetchPaged<ReportResult>(`/reports/${encodeURIComponent(key)}?${queryString(filters)}`),
  csv: (key: string, filters: ReportFilters) =>
    apiDownload(
      `/reports/${encodeURIComponent(key)}.csv?${queryString(filters)}`,
      `${key}-${filters.from}-to-${filters.to}.csv`,
    ),
};
