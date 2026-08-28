// The API client (SYSTEM_PROMPT §11): the ONLY place `fetch` appears. Sends
// cookies (credentials: 'include') and unwraps the standard envelope, throwing
// ApiError with the server's error code on failure.
import type { ErrorCode } from '@somwave/shared';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    meta?: PaginationMeta;
    error?: { code?: ErrorCode; message?: string };
  } | null;
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? 'INTERNAL_ERROR', body?.error?.message);
  }
  return { data: body?.data as T, meta: body?.meta };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request<T>(path, init)).data;
}

// For paginated list endpoints — returns the payload together with meta.total (§10).
export async function apiFetchPaged<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta: PaginationMeta }> {
  const { data, meta } = await request<T>(path, init);
  return {
    data,
    meta: meta ?? { page: 1, pageSize: Array.isArray(data) ? data.length : 0, total: 0 },
  };
}
