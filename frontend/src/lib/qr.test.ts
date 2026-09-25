import { describe, expect, it } from 'vitest';
import { qrSvg } from './qr';

describe('qrSvg', () => {
  it('renders an svg for an otpauth URL', () => {
    const svg = qrSvg('otpauth://totp/Somwave:a@b.com?secret=TESTSECRET&issuer=Somwave');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('QR code');
    expect(svg).toContain('path');
  });
});
