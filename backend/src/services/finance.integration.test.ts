import { afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PERMISSIONS } from '@somwave/shared';
import type { AddressInfo } from 'node:net';
import { financeRouter } from '../routes/finance.routes';
import { errorHandler } from '../middleware/errorHandler';
import { signAccessToken } from '../lib/tokens';
import { prisma } from '../lib/prisma';
import { refreshSession } from './auth.service';
import { hashRefreshToken, verifyAccessToken } from '../lib/tokens';
import {
  closePeriod,
  cancelTransaction,
  createAccount,
  createTransaction,
  financeDashboard,
  projectProfitability,
  postTransaction,
  reverseJournal,
  reviewTransaction,
  submitTransaction,
  updateTransaction,
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
  it('keeps 2FA proof across refresh and leaves older sessions without it', async () => {
    const user = await prisma.user.create({
      data: {
        email: `finance-session-${Date.now()}@example.test`,
        name: 'Finance test user',
        passwordHash: 'test-only-not-a-login',
        twoFactorEnabled: true,
        twoFactorSecret: 'test-only',
      },
    });
    const proof = new Date('2026-10-16T12:00:00.000Z');
    const verifiedToken = `verified-${user.id}`;
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(verifiedToken),
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: proof,
      },
    });
    const verified = await refreshSession(verifiedToken);
    expect(verifyAccessToken(verified.accessToken).mfaVerifiedAt).toBe(proof.getTime());
    expect(
      (
        await prisma.refreshToken.findUniqueOrThrow({
          where: { tokenHash: hashRefreshToken(verified.refreshToken) },
        })
      ).mfaVerifiedAt?.getTime(),
    ).toBe(proof.getTime());

    const oldToken = `old-${user.id}`;
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(oldToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(
      verifyAccessToken((await refreshSession(oldToken)).accessToken).mfaVerifiedAt,
    ).toBeNull();
  });

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
    const editable = await createTransaction(
      {
        type: 'EXPENSE',
        amount: '4.00',
        currency: 'USD',
        category: 'Test expense',
        description: 'Editable draft',
        occurredOn: '2020-02-01T00:00:00.000Z',
        cashAccountId: cash.id,
        offsetAccountId: (
          await createAccount(
            {
              code: `${code}E`,
              name: 'Test expense',
              type: 'EXPENSE',
              currency: 'USD',
              allowPosting: true,
            },
            'test-manager',
          )
        ).id,
      },
      'test-maker',
    );
    const edited = await updateTransaction(
      editable.id,
      {
        amount: '4.25',
        description: 'Corrected draft expense',
      },
      'test-maker',
    );
    expect(edited).toMatchObject({ amount: '4.25', description: 'Corrected draft expense' });
    expect((await cancelTransaction(editable.id, 'test-maker')).status).toBe('CANCELLED');
    await expect(submitTransaction(editable.id, 'test-maker')).rejects.toThrow();
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
    expect(before.trends).toEqual([
      { month: '2020-02', currency: 'USD', revenue: '12.34', expenses: '0.00', netProfit: '12.34' },
    ]);
    expect(before.accountBalances.find((row) => row.code === cash.code)).toMatchObject({
      balance: '12.34',
      type: 'ASSET',
    });
    expect(
      (await financeDashboard(new Date('2020-02-01T00:00:00Z'), new Date('2020-02-02T00:00:00Z')))
        .currencies,
    ).toEqual([]);
    expect(
      (await financeDashboard(new Date('2020-02-02T00:00:00Z'), new Date('2020-02-03T00:00:00Z')))
        .currencies[0]?.revenue,
    ).toBe('12.34');
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
    await expect(
      prisma.financeAccount.update({
        where: { id: revenue.id },
        data: { type: 'EXPENSE' },
      }),
    ).rejects.toThrow('Historical account classification is immutable');
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

describe.skipIf(!local)('finance dashboard HTTP diagnostics', () => {
  it('returns real empty data, validates Mogadishu ranges and enforces MFA and role permissions', async () => {
    const role = await prisma.role.upsert({
      where: { name: 'SUPER_ADMIN' },
      create: { name: 'SUPER_ADMIN' },
      update: {},
    });
    const user = await prisma.user.create({
      data: {
        email: `dashboard-${Date.now()}@example.test`,
        name: 'Dashboard fixture',
        passwordHash: 'not-a-login-password',
        twoFactorEnabled: true,
        roles: { create: { roleId: role.id } },
      },
    });
    const engineerRole = await prisma.role.upsert({
      where: { name: 'ENGINEER' },
      create: { name: 'ENGINEER' },
      update: {},
    });
    const engineer = await prisma.user.create({
      data: {
        email: `dashboard-engineer-${Date.now()}@example.test`,
        name: 'Engineer fixture',
        passwordHash: 'not-a-login-password',
        twoFactorEnabled: true,
        roles: { create: { roleId: engineerRole.id } },
      },
    });
    const app = express();
    app.use(cookieParser());
    app.use('/api/v1/finance', financeRouter);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/finance/dashboard`;
    const request = (id: string, proof: Date | null, query = 'from=1900-01-01&to=1900-02-01') =>
      fetch(`${url}?${query}`, {
        headers: { Cookie: `somwave_access=${signAccessToken(id, proof)}` },
      });
    try {
      const denied = await request(user.id, null);
      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: 'Sign out and sign in with your two-factor code before accessing finance',
        },
      });
      const forbidden = await request(engineer.id, new Date());
      expect(forbidden.status).toBe(403);
      expect(await forbidden.json()).toMatchObject({
        error: { message: 'Insufficient permissions' },
      });
      const ok = await request(user.id, new Date());
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({
        data: {
          from: '1899-12-31T21:00:00.000Z',
          to: '1900-01-31T21:00:00.000Z',
          currencies: [],
          pendingApprovals: 0,
          accountBalances: [],
          timezone: 'Africa/Mogadishu',
        },
      });
      const invalid = await request(user.id, new Date(), 'from=2026-02-30&to=2026-03-01');
      expect(invalid.status).toBe(400);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});

describe.skipIf(!local)('finance role matrix over real HTTP and PostgreSQL', () => {
  // Permission fixtures mirror the existing seed policy; role names alone must
  // never imply privileges (except the explicit SUPER_ADMIN override).
  it.each([
    ['ADMIN', true],
    ['FINANCE_MANAGER', true],
    ['ACCOUNTANT', true],
    ['PROJECT_MANAGER', false],
    ['ENGINEER', false],
    ['CLIENT', false],
  ] as const)('%s receives only its authorized company finance access', async (name, allowed) => {
    const permissionKeys =
      name === 'ADMIN'
        ? [
            PERMISSIONS.FINANCE_READ,
            PERMISSIONS.FINANCE_CREATE,
            PERMISSIONS.FINANCE_APPROVE,
            PERMISSIONS.FINANCE_POST,
            PERMISSIONS.FINANCE_MANAGE,
          ]
        : name === 'FINANCE_MANAGER'
          ? [
              PERMISSIONS.FINANCE_READ,
              PERMISSIONS.FINANCE_CREATE,
              PERMISSIONS.FINANCE_APPROVE,
              PERMISSIONS.FINANCE_MANAGE,
            ]
          : name === 'ACCOUNTANT'
            ? [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_CREATE, PERMISSIONS.FINANCE_POST]
            : [PERMISSIONS.PROJECTS_READ];
    for (const key of permissionKeys)
      await prisma.permission.upsert({ where: { key }, create: { key }, update: {} });
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, permissions: { connect: permissionKeys.map((key) => ({ key })) } },
      update: { permissions: { set: permissionKeys.map((key) => ({ key })) } },
    });
    const user = await prisma.user.create({
      data: {
        email: `finance-matrix-${name.toLowerCase()}-${Date.now()}@example.test`,
        name: `${name} finance fixture`,
        passwordHash: 'not-a-login-password',
        twoFactorEnabled: true,
        roles: { create: { roleId: role.id } },
      },
    });
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/v1/finance', financeRouter);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/finance`;
    const headers = { Cookie: `somwave_access=${signAccessToken(user.id, new Date())}` };
    try {
      for (const endpoint of [
        '/dashboard?from=1900-01-01&to=1900-02-01',
        '/accounts',
        '/transactions',
        '/journals',
        '/link-options',
        '/project-profitability?from=1900-01-01&to=1900-02-01',
        '/trial-balance?from=1900-01-01&to=1900-02-01',
      ]) {
        const response = await fetch(`${base}${endpoint}`, { headers });
        expect(response.status, `${name} ${endpoint}`).toBe(allowed ? 200 : 403);
        if (!allowed)
          expect(await response.json()).toMatchObject({
            error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
          });
      }
      // Authorized calls use missing IDs to avoid changing financial records.
      for (const [action, permit] of [
        ['approve', name === 'ADMIN' || name === 'FINANCE_MANAGER'],
        ['post', name === 'ADMIN' || name === 'ACCOUNTANT'],
      ] as const) {
        const response = await fetch(`${base}/transactions/does-not-exist/${action}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: '{}',
        });
        expect(response.status, `${name} ${action}`).toBe(permit ? 409 : 403);
        if (!permit) expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
