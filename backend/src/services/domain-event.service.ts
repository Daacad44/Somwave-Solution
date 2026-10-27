// Transactional outbox (I8.0). emitEvent writes in the caller's transaction, the
// worker relay publishes PENDING rows to BullMQ, and processDomainEvent runs each
// registered handler at most once per event.
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { DOMAIN_EVENT_HANDLERS, type DomainEventHandlerRegistry } from '../events/handlers';

/** Publish attempts before a row is parked as FAILED for the dead-letter view. */
export const MAX_PUBLISH_ATTEMPTS = 10;
const ERROR_LIMIT = 1000;

export interface EmitEventInput {
  type: string;
  aggregateId: string;
  projectId?: string | null;
  payload: Prisma.InputJsonValue;
}

export interface PublishableEvent {
  id: string;
  type: string;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, ERROR_LIMIT);
}

export async function emitEvent(
  tx: Pick<Prisma.TransactionClient, 'domainEvent'>,
  input: EmitEventInput,
): Promise<string> {
  const row = await tx.domainEvent.create({
    data: {
      type: input.type,
      aggregateId: input.aggregateId,
      projectId: input.projectId ?? null,
      payload: input.payload,
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Publishes up to `limit` unpublished events. Rows are locked with SKIP LOCKED so
 * two relays never publish the same row concurrently; publishing reuses the event
 * id as the job id, and handlers dedupe, so a crash between publish and commit is
 * safe to replay.
 */
export async function relayPendingEvents(
  publish: (event: PublishableEvent) => Promise<void>,
  limit = 100,
): Promise<{ published: number; failed: number }> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<(PublishableEvent & { attempts: number })[]>`
        SELECT "id", "type", "attempts" FROM "domain_events"
        WHERE "status" = 'PENDING' AND "published_at" IS NULL
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      let published = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          await publish({ id: row.id, type: row.type });
          await tx.domainEvent.update({
            where: { id: row.id },
            data: { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
          });
          published += 1;
        } catch (error) {
          failed += 1;
          await tx.domainEvent.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              lastError: errorText(error),
              ...(row.attempts + 1 >= MAX_PUBLISH_ATTEMPTS ? { status: 'FAILED' as const } : {}),
            },
          });
        }
      }
      return { published, failed };
    },
    { timeout: 30_000 },
  );
}

class AlreadyHandled extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Runs every handler registered for the event's type that has not yet completed. */
export async function processDomainEvent(
  eventId: string,
  handlers: DomainEventHandlerRegistry = DOMAIN_EVENT_HANDLERS,
): Promise<'processed' | 'skipped'> {
  const event = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === 'PROCESSED') return 'skipped';
  for (const handler of handlers[event.type] ?? []) {
    try {
      await prisma.$transaction(async (tx) => {
        try {
          // Claim first: a concurrent duplicate blocks on the unique index until
          // this transaction ends, then sees the committed claim and skips.
          await tx.domainEventHandling.create({ data: { eventId, handler: handler.name } });
        } catch (error) {
          if (isUniqueViolation(error)) throw new AlreadyHandled();
          throw error;
        }
        await handler.handle(tx, event);
      });
    } catch (error) {
      if (error instanceof AlreadyHandled) continue;
      throw error;
    }
  }
  await prisma.domainEvent.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
  });
  return 'processed';
}

/** Records a handler failure; `final` parks the event for the dead-letter view. */
export async function recordEventFailure(
  eventId: string,
  error: unknown,
  final: boolean,
): Promise<void> {
  await prisma.domainEvent.updateMany({
    where: { id: eventId, status: { not: 'PROCESSED' } },
    data: {
      attempts: { increment: 1 },
      lastError: errorText(error),
      ...(final ? { status: 'FAILED' as const } : {}),
    },
  });
}
