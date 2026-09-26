import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch } from './apiClient';

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

  it('refreshes the session once and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ data: { id: 'post-1' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ id: string }>('/cms/posts', { method: 'POST' });

    expect(result).toEqual({ id: 'post-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/auth/refresh');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).credentials).toBe('include');
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('POST');
  });

  it('does not loop when the refresh cookie is also missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/cms/posts', { method: 'POST' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'UNAUTHORIZED',
      message: 'Your session has expired. Please sign in again.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('leaves a failed login message unchanged and does not refresh', async () => {
    const fetchMock = mockFetch(401, {
      error: { code: 'UNAUTHORIZED', message: 'Iimayl ama furaha waa khalad' },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Iimayl ama furaha waa khalad',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to INTERNAL_ERROR when the body has no code', async () => {
    vi.stubGlobal('fetch', mockFetch(500, null));
    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('maps a network failure to INTERNAL_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      message: 'Network error',
    });
  });
});
