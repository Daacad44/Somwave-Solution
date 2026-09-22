import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import express from 'express';
import cors from 'cors';
import type { Server } from 'node:http';
import { buildCorsOptions, isAllowedCorsOrigin, normalizeOrigin, parseCorsOrigins } from './cors';

const APP_ORIGIN = 'https://app.somwave.botandev.com';
const WEB_ORIGIN = 'https://somwave.botandev.com';
const LOCAL_ORIGIN = 'http://localhost:5173';
const EVIL_ORIGIN = 'https://evil.example';

const allowlist = [APP_ORIGIN, WEB_ORIGIN, LOCAL_ORIGIN];

function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('expected TCP address'));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

describe('parseCorsOrigins', () => {
  it('trims, drops empties, and rejects a wildcard', () => {
    expect(parseCorsOrigins(` ${APP_ORIGIN} , ${WEB_ORIGIN}/ , * , `)).toEqual([
      APP_ORIGIN,
      WEB_ORIGIN,
    ]);
  });
});

describe('isAllowedCorsOrigin', () => {
  it('allows the production dashboard origin', () => {
    expect(isAllowedCorsOrigin(APP_ORIGIN, allowlist)).toBe(true);
    expect(isAllowedCorsOrigin(`${APP_ORIGIN}/`, allowlist)).toBe(true);
  });

  it('rejects unknown origins and missing Origin', () => {
    expect(isAllowedCorsOrigin(EVIL_ORIGIN, allowlist)).toBe(false);
    expect(isAllowedCorsOrigin(undefined, allowlist)).toBe(false);
  });

  it('normalizes trailing slashes', () => {
    expect(normalizeOrigin(`${WEB_ORIGIN}/`)).toBe(WEB_ORIGIN);
  });
});

describe('CORS preflight and credentialed POST', () => {
  const app = express();
  app.use(cors(buildCorsOptions(allowlist)));
  app.post('/api/v1/auth/login', (_req, res) => {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  });
  app.get('/health', (_req, res) => {
    res.status(200).json({ data: { status: 'ok' } });
  });

  let server: Server;
  let url: string;

  beforeAll(async () => {
    const started = await listen(app);
    server = started.server;
    url = started.url;
  });

  it('answers OPTIONS /api/v1/auth/login for the production dashboard', async () => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: APP_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')?.toUpperCase()).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'content-type',
    );
  });

  it('reflects CORS on a login POST so a 401 is readable, not blocked', async () => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Origin: APP_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'admin@somwave.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('does not grant CORS to an untrusted origin', async () => {
    const res = await fetch(`${url}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: EVIL_ORIGIN,
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('keeps /health reachable', async () => {
    const res = await fetch(`${url}/health`, { headers: { Origin: APP_ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  );
});
