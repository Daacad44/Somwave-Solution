// Merge Coolify's split Redis env (host-only REDIS_URL + REDIS_PASSWORD) into
// ioredis options. Credentials belong in options, not in logs.

export type RedisAuthInput = {
  url: string;
  password?: string;
  username?: string;
};

export type RedisAuthResolved = {
  url: string;
  password?: string;
  username?: string;
};

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isRedisAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /NOAUTH|WRONGPASS|invalid password|invalid username-password/i.test(message);
}

export function resolveRedisAuth(input: RedisAuthInput): RedisAuthResolved {
  const parsed = new URL(input.url);
  const fromUrlPassword = blank(parsed.password ? decodeURIComponent(parsed.password) : undefined);
  const fromUrlUsername = blank(parsed.username ? decodeURIComponent(parsed.username) : undefined);

  parsed.username = '';
  parsed.password = '';

  const password = fromUrlPassword ?? blank(input.password);
  const username = fromUrlUsername ?? blank(input.username);

  return {
    url: parsed.toString(),
    ...(password ? { password } : {}),
    ...(username ? { username } : {}),
  };
}
