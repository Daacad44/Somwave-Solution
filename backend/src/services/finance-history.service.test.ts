import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  transactionCount: vi.fn(),
  transactionFindMany: vi.fn(),
  journalCount: vi.fn(),
  journalFindMany: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({
  prisma: {
    financeTransaction: { count: db.transactionCount, findMany: db.transactionFindMany },
    financeJournal: { count: db.journalCount, findMany: db.journalFindMany },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import { listJournals, listTransactions } from './finance.service';

describe('finance history database filters', () => {
  it('combines status, type, date, account, currency and text before paginating transactions', async () => {
    db.transactionCount.mockResolvedValueOnce(43);
    db.transactionFindMany.mockResolvedValueOnce([]);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');
    const result = await listTransactions({
      page: 2,
      pageSize: 20,
      from,
      to,
      accountId: 'account-1',
      currency: 'USD',
      search: 'INV-123',
      statuses: ['SUBMITTED', 'APPROVED'],
      type: 'INCOME',
    });
    const where = db.transactionFindMany.mock.lastCall?.[0]?.where;
    expect(db.transactionCount).toHaveBeenCalledWith({ where });
    expect(where).toMatchObject({
      status: { in: ['SUBMITTED', 'APPROVED'] },
      type: 'INCOME',
      occurredOn: { gte: from, lt: to },
      OR: [{ cashAccountId: 'account-1' }, { offsetAccountId: 'account-1' }],
      currency: 'USD',
    });
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([{ externalRef: { contains: 'INV-123', mode: 'insensitive' } }]),
    );
    expect(db.transactionFindMany.mock.lastCall?.[0]).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ occurredOn: 'desc' }, { id: 'desc' }],
    });
    expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 43 });
  });

  it('queries finalized journals and filters linked lines without truncating at 100', async () => {
    db.journalCount.mockResolvedValueOnce(203);
    db.journalFindMany.mockResolvedValueOnce([]);
    const result = await listJournals({
      page: 3,
      pageSize: 100,
      accountId: 'account-2',
      sourceType: 'REVERSAL',
      search: 'REV-',
    });
    const where = db.journalFindMany.mock.lastCall?.[0]?.where;
    expect(db.journalCount).toHaveBeenCalledWith({ where });
    expect(where).toMatchObject({
      isFinalized: true,
      lines: { some: { accountId: 'account-2' } },
      sourceType: 'REVERSAL',
    });
    expect(where.OR).toEqual(
      expect.arrayContaining([{ reference: { contains: 'REV-', mode: 'insensitive' } }]),
    );
    expect(db.journalFindMany.mock.lastCall?.[0]).toMatchObject({ skip: 200, take: 100 });
    expect(result.meta.total).toBe(203);
  });
});
