// Prisma client singleton (SYSTEM_PROMPT §5: the service layer is the only layer
// that touches Prisma; this module is what services import).
import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Fast-fail Postgres liveness for /health (§14) — races a timeout so the check
// never hangs when the database is unreachable.
export async function pingPostgres(timeoutMs = 1500): Promise<boolean> {
  const timeout = new Promise<false>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs).unref();
  });
  const query = prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  return Promise.race([query, timeout]);
}
