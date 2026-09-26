// The API client (SYSTEM_PROMPT §11): the ONLY place `fetch` appears. Sends
// cookies (credentials: 'include') and unwraps the standard envelope, throwing
// ApiError with the server's error code on failure.
//
// The access cookie lasts 15 minutes. The refresh cookie lasts 30 days. A CMS
// page can stay open after the access cookie is gone; the next write would
// otherwise 401 with "Authentication required" even though the user still looks
// signed in. On that 401 we call the existing POST /auth/refresh once, then
// retry the original request with the new cookies.
import type { ErrorCode } from '@somwave/shared';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
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

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

let refreshInFlight: Promise<boolean> | null = null;

function shouldRefresh(path: string, status: number, alreadyRetried: boolean): boolean {
  if (status !== 401 || alreadyRetried) return false;
  return path !== '/auth/login' && path !== '/auth/login/2fa' && path !== '/auth/refresh';
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return res.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  alreadyRetried = false,
): Promise<{ data: T; meta?: PaginationMeta }> {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'Network error');
  }
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    meta?: PaginationMeta;
    error?: { code?: ErrorCode; message?: string; details?: unknown };
  } | null;
  if (!res.ok) {
    if (shouldRefresh(path, res.status, alreadyRetried)) {
      const refreshed = await refreshSession();
      if (refreshed) return request(path, init, true);
    }
    const code = body?.error?.code ?? 'INTERNAL_ERROR';
    const message =
      code === 'UNAUTHORIZED' && shouldRefresh(path, res.status, false)
        ? SESSION_EXPIRED
        : body?.error?.message;
    throw new ApiError(code, message, body?.error?.details);
  }
  return { data: body?.data as T, meta: body?.meta };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request<T>(path, init)).data;
}

async function download(path: string, fileName: string, alreadyRetried: boolean): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { credentials: 'include' });
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'Network error');
  }
  if (res.status === 401 && !alreadyRetried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      await download(path, fileName, true);
      return;
    }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: ErrorCode; message?: string; details?: unknown };
    } | null;
    const code = body?.error?.code ?? 'INTERNAL_ERROR';
    throw new ApiError(
      code,
      code === 'UNAUTHORIZED' ? SESSION_EXPIRED : body?.error?.message,
      body?.error?.details,
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Authenticated binary download — still the only module that calls fetch. */
export function apiDownload(path: string, fileName: string): Promise<void> {
  return download(path, fileName, false);
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
