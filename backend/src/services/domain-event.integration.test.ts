import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import type { DomainEventHandlerRegistry } from '../events/handlers';
import { emitEvent, processDomainEvent, relayPendingEvents } from './domain-event.service';

// Writes only to an explicitly named disposable local database (see payment.integration.test.ts).
const database = process.env.FINANCE_TEST_DATABASE_URL;
const local =
  database &&
  /^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):\d+\/somwave_.*_test(?:\?|$)/.test(
    database,
  ) &&
  process.env.DATABASE_URL === database;

afterAll(async () => {
  if (local) await prisma.$disconnect();
});

describe.skipIf(!local)('domain event outbox (PostgreSQL)', () => {
  it('rolls the event back with the business change', async () => {
    const aggregateId = `agg-${randomUUID()}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await emitEvent(tx, { type: 'test.rolled_back', aggregateId, payload: {} });
        throw new Error('business change failed');
      }),
    ).rejects.toThrow('business change failed');
    expect(await prisma.domainEvent.count({ where: { aggregateId } })).toBe(0);
  });

  it('publishes each pending event once even with two relays racing', async () => {
    const aggregateId = `agg-${randomUUID()}`;
    const ids = await prisma.$transaction(async (tx) =>
      Promise.all(
        [1, 2, 3].map((n) => emitEvent(tx, { type: 'test.relay', aggregateId, payload: { n } })),
      ),
    );
    const published: string[] = [];
    const publish = async (event: { id: string }) => {
      if (ids.includes(event.id)) published.push(event.id);
    };
    await Promise.all([relayPendingEvents(publish), relayPendingEvents(publish)]);
    expect([...published].sort()).toEqual([...ids].sort());
    const rows = await prisma.domainEvent.findMany({ where: { aggregateId } });
    expect(rows.every((row) => row.status === 'PUBLISHED' && row.publishedAt)).toBe(true);
  });

  it('runs a handler once when the same event is processed concurrently and replayed', async () => {
    const aggregateId = `agg-${randomUUID()}`;
    const eventId = await prisma.$transaction((tx) =>
      emitEvent(tx, { type: 'test.handled', aggregateId, payload: {} }),
    );
    let runs = 0;
    const handlers: DomainEventHandlerRegistry = {
      'test.handled': [
        {
          name: 'test.counter',
          handle: async (tx, event) => {
            runs += 1;
            await tx.auditLog.create({
              data: { action: 'test.handled', subjectType: 'DomainEvent', subjectId: event.id },
            });
          },
        },
      ],
    };
    await Promise.all([
      processDomainEvent(eventId, handlers),
      processDomainEvent(eventId, handlers),
    ]);
    expect(await processDomainEvent(eventId, handlers)).toBe('skipped');
    expect(runs).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { action: 'test.handled', subjectId: eventId } }),
    ).toBe(1);
    const event = await prisma.domainEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe('PROCESSED');
  });

  it('rolls back a failed handler so the retry runs it again', async () => {
    const aggregateId = `agg-${randomUUID()}`;
    const eventId = await prisma.$transaction((tx) =>
      emitEvent(tx, { type: 'test.retry', aggregateId, payload: {} }),
    );
    let fail = true;
    const handlers: DomainEventHandlerRegistry = {
      'test.retry': [
        {
          name: 'test.flaky',
          handle: async () => {
            if (fail) throw new Error('transient');
          },
        },
      ],
    };
    await expect(processDomainEvent(eventId, handlers)).rejects.toThrow('transient');
    expect(await prisma.domainEventHandling.count({ where: { eventId } })).toBe(0);
    fail = false;
    expect(await processDomainEvent(eventId, handlers)).toBe('processed');
    expect(await prisma.domainEventHandling.count({ where: { eventId } })).toBe(1);
  });
});
