import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { correlationId, withRequestContext } from './requestContext';

describe('request correlation', () => {
  it('generates a server-owned ID and keeps it across awaited work', async () => {
    const headers = new Map<string, string>();
    const req = { headers: { 'x-request-id': 'untrusted-client-value' } } as unknown as Request;
    const res = {
      setHeader: vi.fn((name: string, value: string) => {
        headers.set(name, value);
        return res;
      }),
    } as unknown as Response;

    let observed: string | null = null;
    await new Promise<void>((resolve) => {
      const next = (() => {
        Promise.resolve().then(() => {
          observed = correlationId();
          resolve();
        });
      }) as NextFunction;
      withRequestContext(req, res, next);
    });

    const generated = headers.get('X-Request-ID');
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(generated).not.toBe('untrusted-client-value');
    expect(observed).toBe(generated);
    expect(correlationId()).toBeNull();
  });
});
