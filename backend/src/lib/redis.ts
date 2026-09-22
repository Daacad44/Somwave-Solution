// Redis client (SYSTEM_PROMPT §4). Lazy-connects on first command so importing
// this module never forces a connection (keeps typecheck and tests side-effect
// free). Caching and BullMQ build on this in later phases.
import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';
import { isRedisAuthError, resolveRedisAuth } from './redisAuth';

const auth = resolveRedisAuth({
  url: env.REDIS_URL,
  password: env.REDIS_PASSWORD,
  username: env.REDIS_USERNAME,
});

export const redis = new Redis(auth.url, {
  lazyConnect: true,
  connectTimeout: 2000,
  // Bounded so a command fails fast when Redis is down instead of queueing
  // forever — the health check must never hang (see pingRedis).
  maxRetriesPerRequest: 2,
  retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  ...(auth.password ? { password: auth.password } : {}),
  ...(auth.username ? { username: auth.username } : {}),
});

redis.on('error', (err) => {
  logger.error(
    {
      err,
      ...(isRedisAuthError(err)
        ? {
            hint: 'Redis requires AUTH. Set REDIS_PASSWORD, or put the password in REDIS_URL as redis://:PASSWORD@host:6379',
          }
        : {}),
    },
    'Redis connection error',
  );
});

// Resolves false rather than hanging when Redis is unreachable: the ping races a
// short timer (unref'd so it never keeps the process alive).
export async function pingRedis(timeoutMs = 1500): Promise<boolean> {
  const timeout = new Promise<false>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs).unref();
  });
  const ping = redis
    .ping()
    .then((reply) => reply === 'PONG')
    .catch(() => false);
  return Promise.race([ping, timeout]);
}
