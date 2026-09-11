import { describe, it, expect } from 'vitest';
import { authCookieBaseOptions } from './cookies';

describe('authCookieBaseOptions', () => {
  it('uses Lax on http localhost so the Vite dev server can keep a session', () => {
    expect(authCookieBaseOptions('development')).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('uses None+Secure in production so app.* → api.* login cookies persist', () => {
    expect(authCookieBaseOptions('production')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
  });
});
