import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app';

const LOCAL_ORIGIN = 'http://localhost:5173';
const EVIL_ORIGIN = 'https://evil.example';

describe('createApp CORS (helmet + allow-list)', () => {
  let server: Server;
  let url: string;

  beforeAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server = createApp().listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string') {
            reject(new Error('expected TCP address'));
            return;
          }
          url = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('handles OPTIONS /api/v1/auth/login for the configured origin', async () => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: LOCAL_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(LOCAL_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
  });

  it('returns UNAUTHORIZED on /api/v1/auth/me without cookies, with CORS headers', async () => {
    const res = await fetch(`${url}/api/v1/auth/me`, {
      headers: { Origin: LOCAL_ORIGIN, Accept: 'application/json' },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe(LOCAL_ORIGIN);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('does not reflect an untrusted Origin on preflight', async () => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: EVIL_ORIGIN,
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('serves /health without requiring CORS for monitors', async () => {
    const res = await fetch(`${url}/health`);
    expect([200, 503]).toContain(res.status);
  });
});
