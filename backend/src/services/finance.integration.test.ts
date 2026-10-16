import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma';
import {
  closePeriod,
  createAccount,
  createTransaction,
  financeDashboard,
  projectProfitability,
  postTransaction,
  reverseJournal,
  reviewTransaction,
  submitTransaction,
} from './finance.service';

// This test writes to a disposable local PostgreSQL database only. It is skipped
// in ordinary unit/CI runs and must never be pointed at a company database.
const database = process.env.FINANCE_TEST_DATABASE_URL;
const local =
  database &&
  /^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):\d+\//.test(database) &&
  process.env.DATABASE_URL === database;

afterAll(async () => {
  if (local) await prisma.$disconnect();
});

describe.skipIf(!local)('finance ledger integration', () => {
  it('posts an approved entry, reverses it, and blocks closed-period writes and mutation', async () => {
    const code = `T${Date.now()}`;
    const cash = await createAccount(
      {
        code: `${code}A`,
        name: 'Test cash',
        type: 'ASSET',
        currency: 'USD',
        allowPosting: true,
      },
      'test-manager',
    );
    const revenue = await createAccount(
      {
        code: `${code}R`,
        name: 'Test revenue',
        type: 'REVENUE',
        currency: 'USD',
        allowPosting: true,
      },
      'test-manager',
    );
    const project = await prisma.project.create({ data: { name: `Finance test ${code}` } });
    const record = await createTransaction(
      {
        type: 'INCOME',
        amount: '12.34',
        currency: 'USD',
        category: 'Test income',
        description: 'Controlled ledger integration test',
        occurredOn: '2020-02-02T00:00:00.000Z',
        cashAccountId: cash.id,
        offsetAccountId: revenue.id,
        projectId: project.id,
      },
      'test-maker',
    );
    await submitTransaction(record.id, 'test-maker');
    await expect(reviewTransaction(record.id, 'test-maker', true)).rejects.toThrow('self-approval');
    await reviewTransaction(record.id, 'test-reviewer', true);
    const posted = await postTransaction(record.id, 'test-poster');
    expect(posted.status).toBe('POSTED');
    expect(posted.postedJournalId).toBeTruthy();
    const before = await financeDashboard(new Date('2020-02-01'), new Date('2020-03-01'));
    expect(before.currencies[0]).toMatchObject({
      currency: 'USD',
      revenue: '12.34',
      debits: '12.34',
      credits: '12.34',
      balanced: true,
    });
    expect(
      (await projectProfitability(new Date('2020-02-01'), new Date('2020-03-01')))[0],
    ).toMatchObject({
      projectId: project.id,
      revenue: '12.34',
      netProfit: '12.34',
      marginPercent: '100.0',
    });
    await expect(
      prisma.financeJournal.update({
        where: { id: posted.postedJournalId! },
        data: { memo: 'Tampered' },
      }),
    ).rejects.toThrow();
    await reverseJournal(posted.postedJournalId!, 'test-manager', 'Controlled test reversal');
    // Reversals post in the current open period, preserving the old period's history.
    const after = await financeDashboard(new Date('2020-01-01'), new Date('2099-01-01'));
    expect(after.currencies[0]).toMatchObject({
      revenue: '0.00',
      debits: '24.68',
      credits: '24.68',
      balanced: true,
    });
    await expect(
      prisma.$transaction(async (tx) => {
        const bad = await tx.financeJournal.create({
          data: {
            reference: `BAD-${code}`,
            occurredOn: new Date('2020-02-04'),
            currency: 'USD',
            memo: 'Must fail',
            createdById: 'test-poster',
            lines: {
              create: [
                { accountId: cash.id, debit: '1.00', credit: '0' },
                { accountId: revenue.id, debit: '0', credit: '0.99' },
              ],
            },
          },
        });
        await tx.financeJournal.update({ where: { id: bad.id }, data: { isFinalized: true } });
      }),
    ).rejects.toThrow('balanced lines');
    const late = await createTransaction(
      {
        type: 'INCOME',
        amount: '1.00',
        currency: 'USD',
        category: 'Test income',
        description: 'Must not post into a closed period',
        occurredOn: '2020-02-03T00:00:00.000Z',
        cashAccountId: cash.id,
        offsetAccountId: revenue.id,
      },
      'test-maker',
    );
    await submitTransaction(late.id, 'test-maker');
    await reviewTransaction(late.id, 'test-reviewer', true);
    await expect(closePeriod(2020, 2, 'test-manager')).rejects.toThrow('Resolve submitted');
    await postTransaction(late.id, 'test-poster');
    await closePeriod(2020, 2, 'test-manager');
    await expect(
      createTransaction(
        {
          type: 'INCOME',
          amount: '1.00',
          currency: 'USD',
          category: 'Test income',
          description: 'Must not enter a closed period',
          occurredOn: '2020-02-04T00:00:00.000Z',
          cashAccountId: cash.id,
          offsetAccountId: revenue.id,
        },
        'test-maker',
      ),
    ).rejects.toThrow('Accounting period is closed');
  });
});
