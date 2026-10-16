import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from './externalUrl';

describe('safeExternalUrl', () => {
  it('accepts public HTTP(S) links and rejects credentials, scripts and local hosts', () => {
    expect(safeExternalUrl('https://example.com/demo')).toBe('https://example.com/demo');
    expect(safeExternalUrl('http://example.com/')).toBe('http://example.com/');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('https://user:secret@example.com')).toBeNull();
    expect(safeExternalUrl('http://127.0.0.1:3000')).toBeNull();
    expect(safeExternalUrl('http://localhost:3000')).toBeNull();
  });
});
