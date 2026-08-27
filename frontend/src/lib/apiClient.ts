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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { code?: ErrorCode; message?: string };
  } | null;
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? 'INTERNAL_ERROR', body?.error?.message);
  }
  return body?.data as T;
}
