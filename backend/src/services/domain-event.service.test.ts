import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../lib/prisma', () => ({
  prisma: {
    domainEvent: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma';
import {
  MAX_PUBLISH_ATTEMPTS,
  emitEvent,
  processDomainEvent,
  recordEventFailure,
  relayPendingEvents,
} from './domain-event.service';

const event = {
  id: 'evt_1',
  type: 'test.event',
  aggregateId: 'agg_1',
  projectId: null,
  payload: {},
  status: 'PUBLISHED',
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('emitEvent', () => {
  it('writes through the caller transaction', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'evt_1' });
    const id = await emitEvent({ domainEvent: { create } } as never, {
      type: 'invoice.issued',
      aggregateId: 'inv_1',
      projectId: 'prj_1',
      payload: { total: '10.00' },
    });
    expect(id).toBe('evt_1');
    expect(create).toHaveBeenCalledWith({
      data: {
        type: 'invoice.issued',
        aggregateId: 'inv_1',
        projectId: 'prj_1',
        payload: { total: '10.00' },
      },
      select: { id: true },
    });
  });
});

describe('relayPendingEvents', () => {
  function withRows(rows: { id: string; type: string; attempts: number }[]) {
    const update = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        $queryRaw: vi.fn().mockResolvedValue(rows),
        domainEvent: { update },
      }),
    );
    return update;
  }

  it('marks published rows', async () => {
    const update = withRows([{ id: 'evt_1', type: 'a', attempts: 0 }]);
    const publish = vi.fn().mockResolvedValue(undefined);
    await expect(relayPendingEvents(publish)).resolves.toEqual({ published: 1, failed: 0 });
    expect(publish).toHaveBeenCalledWith({ id: 'evt_1', type: 'a' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: expect.objectContaining({ status: 'PUBLISHED', lastError: null }),
    });
  });

  it('records a publish failure and parks the row after the last attempt', async () => {
    const update = withRows([
      { id: 'evt_1', type: 'a', attempts: 0 },
      { id: 'evt_2', type: 'a', attempts: MAX_PUBLISH_ATTEMPTS - 1 },
    ]);
    const publish = vi.fn().mockRejectedValue(new Error('redis down'));
    await expect(relayPendingEvents(publish)).resolves.toEqual({ published: 0, failed: 2 });
    expect(update.mock.calls[0]?.[0].data).toEqual({
      attempts: { increment: 1 },
      lastError: 'redis down',
    });
    expect(update.mock.calls[1]?.[0].data).toMatchObject({ status: 'FAILED' });
  });
});

describe('processDomainEvent', () => {
  it('skips a missing or already processed event', async () => {
    vi.mocked(prisma.domainEvent.findUnique).mockResolvedValueOnce(null);
    await expect(processDomainEvent('gone', {})).resolves.toBe('skipped');
    vi.mocked(prisma.domainEvent.findUnique).mockResolvedValueOnce({
      ...event,
      status: 'PROCESSED',
    } as never);
    await expect(processDomainEvent('evt_1', {})).resolves.toBe('skipped');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('claims, runs each handler, then marks the event processed', async () => {
    vi.mocked(prisma.domainEvent.findUnique).mockResolvedValue(event as never);
    const create = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({ domainEventHandling: { create } }),
    );
    const handle = vi.fn().mockResolvedValue(undefined);
    const result = await processDomainEvent('evt_1', {
      'test.event': [
        { name: 'first', handle },
        { name: 'second', handle },
      ],
    });
    expect(result).toBe('processed');
    expect(create.mock.calls.map((call) => call[0].data.handler)).toEqual(['first', 'second']);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(prisma.domainEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      data: expect.objectContaining({ status: 'PROCESSED' }),
    });
  });

  it('skips a handler whose claim already exists', async () => {
    vi.mocked(prisma.domainEvent.findUnique).mockResolvedValue(event as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        domainEventHandling: { create: vi.fn().mockRejectedValue(uniqueViolation()) },
      }),
    );
    const handle = vi.fn();
    await expect(
      processDomainEvent('evt_1', { 'test.event': [{ name: 'done', handle }] }),
    ).resolves.toBe('processed');
    expect(handle).not.toHaveBeenCalled();
  });

  it('does not mistake a unique violation inside the handler for a replay', async () => {
    vi.mocked(prisma.domainEvent.findUnique).mockResolvedValue(event as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        domainEventHandling: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
    const handle = vi.fn().mockRejectedValue(uniqueViolation());
    await expect(
      processDomainEvent('evt_1', { 'test.event': [{ name: 'bills', handle }] }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(prisma.domainEvent.update).not.toHaveBeenCalled();
  });
});

describe('recordEventFailure', () => {
  it('parks the event only on the final attempt', async () => {
    await recordEventFailure('evt_1', new Error('boom'), false);
    await recordEventFailure('evt_1', new Error('boom'), true);
    const [first, last] = vi.mocked(prisma.domainEvent.updateMany).mock.calls;
    expect(first?.[0].data).toEqual({ attempts: { increment: 1 }, lastError: 'boom' });
    expect(last?.[0].data).toMatchObject({ status: 'FAILED' });
  });
});
