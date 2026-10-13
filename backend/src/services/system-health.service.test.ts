import { describe, expect, it } from 'vitest';
import { allowedHealthUrl, isPublicHealthAddress } from './system-health.service';

describe('health probe destination guard', () => {
  const hosts = 'app.example.com, status.example.com';

  it('allows only exact HTTPS hosts configured by the operator', () => {
    expect(allowedHealthUrl('https://app.example.com/health', hosts)?.pathname).toBe('/health');
    expect(allowedHealthUrl('https://sub.app.example.com/health', hosts)).toBeNull();
    expect(allowedHealthUrl('http://app.example.com/health', hosts)).toBeNull();
    expect(allowedHealthUrl('https://app.example.com:8443/health', hosts)).toBeNull();
  });

  it('rejects direct IPs, local names, credentials, and malformed URLs', () => {
    expect(allowedHealthUrl('https://127.0.0.1/', '127.0.0.1')).toBeNull();
    expect(allowedHealthUrl('https://[::1]/', '[::1]')).toBeNull();
    expect(allowedHealthUrl('https://localhost/', 'localhost')).toBeNull();
    expect(allowedHealthUrl('https://user:pass@app.example.com/', hosts)).toBeNull();
    expect(allowedHealthUrl('not a url', hosts)).toBeNull();
  });

  it('rejects private DNS answers before pinning a connection address', () => {
    for (const address of [
      '127.0.0.1',
      '10.2.3.4',
      '169.254.1.1',
      '192.168.1.2',
      '::1',
      'fc00::1',
      '::ffff:127.0.0.1',
    ])
      expect(isPublicHealthAddress(address)).toBe(false);
    expect(isPublicHealthAddress('8.8.8.8')).toBe(true);
    expect(isPublicHealthAddress('2606:4700:4700::1111')).toBe(true);
  });
});
