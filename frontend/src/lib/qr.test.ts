import { describe, expect, it } from 'vitest';
import { encodeQrMatrix } from './qr';

describe('qr', () => {
  it('encodes a short otpauth URL into a square matrix with finder corners', () => {
    const matrix = encodeQrMatrix('otpauth://totp/Somwave:a@b.com?secret=TEST');
    expect(matrix).not.toBeNull();
    expect(matrix?.length).toBeGreaterThan(20);
    expect(matrix?.[0]?.length).toBe(matrix?.length);
    expect(matrix?.[0]?.[0]).toBe(true);
  });

  it('returns null for an empty payload', () => {
    expect(encodeQrMatrix('')).toBeNull();
  });
});
