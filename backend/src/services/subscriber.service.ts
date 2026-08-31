// Newsletter subscribers (W5.4, §5: only services touch Prisma). Subscribing is
// idempotent on the email — a repeat sign-up re-activates rather than duplicating.
import type { CreateSubscriberInput, AdminSubscriber } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

// Public subscribe. Normalises the email and upserts so the same address never
// creates a duplicate row (§10 idempotency).
export async function subscribe(input: CreateSubscriberInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  const row = await prisma.subscriber.upsert({
    where: { email },
    update: { isActive: true },
    create: { email, source: 'website' },
    select: { id: true },
  });
  return row;
}

// ── CMS (W5.4) — staff view/remove the list ───────────────────────────────────

const adminSelect = { id: true, email: true, isActive: true, createdAt: true } as const;

type SubscriberRow = { id: string; email: string; isActive: boolean; createdAt: Date };

function toAdmin(row: SubscriberRow): AdminSubscriber {
  return {
    id: row.id,
    email: row.email,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSubscribers(): Promise<AdminSubscriber[]> {
  const rows = await prisma.subscriber.findMany({
    orderBy: { createdAt: 'desc' },
    select: adminSelect,
  });
  return rows.map(toAdmin);
}

export async function deleteSubscriber(id: string): Promise<void> {
  const subscriber = await prisma.subscriber.findUnique({ where: { id } });
  if (!subscriber) throw new AppError('NOT_FOUND', 404, 'Diiwaangalahan lama helin');
  await prisma.subscriber.delete({ where: { id } });
}
