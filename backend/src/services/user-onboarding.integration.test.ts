import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { hashRefreshToken } from '../lib/tokens';
import { verifyPassword } from '../lib/password';
import { activateInvitation } from './user-invitation.service';
import {
  getUserAuthContext,
  requestPasswordReset,
  refreshSession,
  resetPassword,
  verifyPasswordResetCode,
} from './auth.service';

const mail = vi.hoisted(() => ({ send: vi.fn(async (_input: unknown) => ({ sent: true })) }));
vi.mock('../lib/mailer', () => ({
  sendMail: mail.send,
  emailReadiness: () => ({ configured: true }),
}));

// Never run these write tests against the application database.
const database = process.env.FINANCE_TEST_DATABASE_URL;
const disposable = Boolean(
  database &&
  /^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):\d+\/somwave_.*_test(?:\?|$)/.test(
    database,
  ) &&
  process.env.DATABASE_URL === database,
);
afterAll(async () => {
  if (disposable) await prisma.$disconnect();
});

describe.skipIf(!disposable)('user onboarding PostgreSQL concurrency', () => {
  it('consumes an invitation once and creates exactly one role-bound account', async () => {
    const role = await prisma.role.upsert({
      where: { name: 'ENGINEER' },
      create: { name: 'ENGINEER' },
      update: {},
    });
    const token = randomUUID();
    const email = `activation-${randomUUID()}@example.test`;
    await prisma.userInvitation.create({
      data: {
        email,
        name: 'Controlled invite',
        roleIds: [role.id],
        tokenHash: hashRefreshToken(token),
        expiresAt: new Date(Date.now() + 60000),
        invitedById: 'disposable-test-actor',
      },
    });
    const results = await Promise.allSettled([
      activateInvitation(token, 'Mosaic!7River8'),
      activateInvitation(token, 'Mosaic!7River8'),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((value) => value.status === 'rejected')).toHaveLength(1);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { roles: true, engineerProfile: true },
    });
    expect(user.roles.map((value) => value.roleId)).toEqual([role.id]);
    expect(user.engineerProfile?.status).toBe('ACTIVE');
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('Mosaic!7River8', user.passwordHash)).toBe(true);
    expect((await prisma.userInvitation.findUniqueOrThrow({ where: { email } })).status).toBe(
      'ACCEPTED',
    );
    await expect(activateInvitation(token, 'Another!8River9')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('serializes OTP request and verification, consumes reset once, and revokes existing sessions', async () => {
    mail.send.mockClear();
    const user = await prisma.user.create({
      data: {
        email: `reset-${randomUUID()}@example.test`,
        name: 'Controlled recovery',
        passwordHash: 'not-a-login',
      },
    });
    const issuedAt = Date.now() - 10000;
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(randomUUID()),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    expect(await getUserAuthContext(user.id, issuedAt)).not.toBeNull();
    await Promise.all([requestPasswordReset(user.email), requestPasswordReset(user.email)]);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const delivery = mail.send.mock.calls[0]?.[0] as { vars: { code: string } };
    expect(delivery.vars.code).toMatch(/^\d{6}$/);
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.codeHash).not.toBe(delivery.vars.code);
    const verified = await Promise.allSettled([
      verifyPasswordResetCode(user.email, delivery.vars.code),
      verifyPasswordResetCode(user.email, delivery.vars.code),
    ]);
    expect(verified.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    const success = verified.find((value) => value.status === 'fulfilled');
    if (!success || success.status !== 'fulfilled') throw new Error('No reset proof');
    const resets = await Promise.allSettled([
      resetPassword(success.value.token, 'Mosaic!7River8'),
      resetPassword(success.value.token, 'Mosaic!7River8'),
    ]);
    expect(resets.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(resets.filter((value) => value.status === 'rejected')).toHaveLength(1);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(
      0,
    );
    expect(await getUserAuthContext(user.id, issuedAt)).toBeNull();
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword('Mosaic!7River8', updated.passwordHash)).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { subjectId: user.id, action: 'auth.password.reset' } }),
    ).toBe(1);
  });
  it('a reset racing refresh leaves no usable old-credential session', async () => {
    mail.send.mockClear();
    const user = await prisma.user.create({
      data: {
        email: `race-${randomUUID()}@example.test`,
        name: 'Controlled refresh race',
        passwordHash: 'not-a-login',
      },
    });
    const raw = randomUUID();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(raw),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    await requestPasswordReset(user.email);
    const delivery = mail.send.mock.calls[0]?.[0] as { vars: { code: string } };
    const proof = await verifyPasswordResetCode(user.email, delivery.vars.code);
    const [reset, refreshed] = await Promise.allSettled([
      resetPassword(proof.token, 'Mosaic!7River8'),
      refreshSession(raw),
    ]);
    expect(reset.status).toBe('fulfilled');
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(
      0,
    );
    if (refreshed.status === 'fulfilled') {
      await expect(refreshSession(refreshed.value.refreshToken)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    }
    await expect(refreshSession(raw)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
