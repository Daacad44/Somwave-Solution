import { describe, it, expect } from 'vitest';
import { isRedisAuthError, resolveRedisAuth } from './redisAuth';

describe('resolveRedisAuth', () => {
  it('leaves a password-less local URL unchanged', () => {
    expect(resolveRedisAuth({ url: 'redis://localhost:6379' })).toEqual({
      url: 'redis://localhost:6379',
    });
  });

  it('applies REDIS_PASSWORD when the URL has no credentials', () => {
    expect(
      resolveRedisAuth({
        url: 'redis://cn53k1ij8duwc98l24qtkcx2:6379',
        password: 'coolify-secret',
      }),
    ).toEqual({
      url: 'redis://cn53k1ij8duwc98l24qtkcx2:6379',
      password: 'coolify-secret',
    });
  });

  it('reads credentials already present in REDIS_URL', () => {
    expect(resolveRedisAuth({ url: 'redis://:url-secret@redis:6379' })).toEqual({
      url: 'redis://redis:6379',
      password: 'url-secret',
    });
  });

  it('prefers URL credentials over REDIS_PASSWORD', () => {
    expect(
      resolveRedisAuth({
        url: 'redis://default:url-secret@redis:6379',
        password: 'env-secret',
        username: 'env-user',
      }),
    ).toEqual({
      url: 'redis://redis:6379',
      password: 'url-secret',
      username: 'default',
    });
  });

  it('ignores blank password and username', () => {
    expect(
      resolveRedisAuth({
        url: 'redis://localhost:6379',
        password: '  ',
        username: '',
      }),
    ).toEqual({ url: 'redis://localhost:6379' });
  });
});

describe('isRedisAuthError', () => {
  it('detects NOAUTH from Coolify Redis requirepass', () => {
    expect(isRedisAuthError(new Error('NOAUTH Authentication required.'))).toBe(true);
  });

  it('does not flag a connection timeout as auth', () => {
    expect(isRedisAuthError(new Error('Connection is closed.'))).toBe(false);
  });
});
