import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from './apiClient';

function mockFetch(status: number, payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('unwraps the data envelope and sends cookies', async () => {
    const fetchMock = mockFetch(200, { data: { id: 'u1' } });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ id: string }>('/auth/me');

    expect(result).toEqual({ id: 'u1' });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('throws ApiError carrying the server error code on failure', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { error: { code: 'UNAUTHORIZED', message: 'nope' } }));

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'UNAUTHORIZED',
      message: 'nope',
    });
    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to INTERNAL_ERROR when the body has no code', async () => {
    vi.stubGlobal('fetch', mockFetch(500, null));
    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
