import { describe, it, expect } from 'vitest';
import { readIdempotencyKey, idempotencyCacheKey } from './idempotency';

describe('readIdempotencyKey', () => {
  it('accepts a well-formed key', () => {
    expect(readIdempotencyKey('send-invoice-abc12345')).toBe('send-invoice-abc12345');
  });

  it('rejects a missing or short key', () => {
    expect(() => readIdempotencyKey(undefined)).toThrow();
    expect(() => readIdempotencyKey('short')).toThrow();
  });
});

describe('idempotencyCacheKey', () => {
  it('scopes the key to actor and operation', () => {
    expect(idempotencyCacheKey('invoice-send:inv_1', 'user_1', 'abc12345')).toBe(
      'idempotency:invoice-send:inv_1:user_1:abc12345',
    );
  });
});
