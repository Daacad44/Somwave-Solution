// BullMQ needs its own ioredis connection: blocking worker commands require
// `maxRetriesPerRequest: null`, unlike the fail-fast API client in lib/redis.ts.
import { Redis } from 'ioredis';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { resolveRedisAuth } from '../lib/redisAuth';

export function createQueueConnection(): Redis {
  const auth = resolveRedisAuth({
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
  });
  const connection = new Redis(auth.url, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    ...(auth.password ? { password: auth.password } : {}),
    ...(auth.username ? { username: auth.username } : {}),
  });
  connection.on('error', (err) => logger.error({ err }, 'Queue Redis connection error'));
  return connection;
}
