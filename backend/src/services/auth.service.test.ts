import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    twoFactorBackupCode: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
      typeof ops === 'function' ? ops(prisma) : Promise.all(ops),
    ),
  },
}));

vi.mock('../lib/password', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));
vi.mock('../lib/password-policy', () => ({ assertNewPasswordAllowed: vi.fn() }));

vi.mock('../lib/totp', () => ({
  createTotpSecret: vi.fn(() => 'TESTSECRET'),
  totpUri: vi.fn(() => 'otpauth://totp/Somwave:a@b.com'),
  verifyTotp: vi.fn(),
}));

vi.mock('../lib/mailer', () => ({
  sendMail: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { hashRefreshToken, signTwoFactorChallenge } from '../lib/tokens';
import { verifyPassword } from '../lib/password';
import { assertNewPasswordAllowed } from '../lib/password-policy';
import { verifyTotp } from '../lib/totp';
import { sendMail } from '../lib/mailer';
import {
  login,
  startTwoFactorEnrolment,
  confirmTwoFactorEnrolment,
  disableTwoFactor,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
  getUserAuthContext,
  refreshSession,
  stepUpTwoFactor,
  verifyTwoFactorLogin,
} from './auth.service';
import { verifyAccessToken } from '../lib/tokens';

const user = {
  id: 'user_1',
  email: 'a@b.com',
  name: 'Cali',
  passwordHash: 'hash',
  clientId: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  isActive: true,
  deletedAt: null,
  roles: [
    {
      role: {
        name: 'ADMIN',
        permissions: [{ key: 'users.read' }],
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login', () => {
  it('issues a session when 2FA is not enabled', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as never);
    const result = await login('a@b.com', 'secret');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { engineerProfile: { is: { status: 'SUSPENDED' } } },
        }),
      }),
    );
    expect(result.kind).toBe('session');
    if (result.kind === 'session') {
      expect(result.session.user.twoFactorRequired).toBe(true);
      expect(result.session.user.twoFactorEnabled).toBe(false);
    }
  });

  it('returns a challenge when 2FA is enabled', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      twoFactorEnabled: true,
      twoFactorSecret: 'stored',
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const result = await login('a@b.com', 'secret');
    expect(result.kind).toBe('twoFactor');
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('preserves the Super Admin two-factor login path', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      roles: [{ role: { name: 'SUPER_ADMIN', permissions: [] } }],
      twoFactorEnabled: true,
      twoFactorSecret: 'stored',
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const result = await login('a@b.com', 'legacy-password');
    expect(result.kind).toBe('twoFactor');
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects a bad password', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    await expect(login('a@b.com', 'nope')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('two-factor enrolment', () => {
  it('stores a pending secret without enabling', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(prisma.user.update).mockResolvedValue(user as never);
    const result = await startTwoFactorEnrolment('user_1');
    expect(result.otpauthUrl).toContain('otpauth://');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ twoFactorEnabled: false }),
      }),
    );
  });

  it('enables 2FA after a valid confirmation code and returns backup codes', async () => {
    const pending = { ...user, twoFactorSecret: 'stored' };
    const enabled = { ...user, twoFactorSecret: 'stored', twoFactorEnabled: true };
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(pending as never)
      .mockResolvedValueOnce(enabled as never);
    vi.mocked(verifyTotp).mockResolvedValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue(enabled as never);
    vi.mocked(prisma.twoFactorBackupCode.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.twoFactorBackupCode.createMany).mockResolvedValue({ count: 8 } as never);
    const result = await confirmTwoFactorEnrolment('user_1', '123456');
    expect(result.user.twoFactorEnabled).toBe(true);
    expect(result.backupCodes).toHaveLength(8);
    // The replacement session proves MFA, so finance opens without signing in again.
    expect(verifyAccessToken(result.session.accessToken).mfaVerifiedAt).toEqual(expect.any(Number));
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', mfaVerifiedAt: expect.any(Date) }),
    });
  });

  it('upgrades the current session with MFA proof after a valid step-up code', async () => {
    const enabled = { ...user, twoFactorSecret: 'stored', twoFactorEnabled: true };
    vi.mocked(prisma.user.findFirst).mockResolvedValue(enabled as never);
    vi.mocked(prisma.user.update).mockResolvedValue(enabled as never);
    vi.mocked(verifyTotp).mockResolvedValue(true);
    const session = await stepUpTwoFactor('user_1', '123456');
    expect(verifyAccessToken(session.accessToken).mfaVerifiedAt).toEqual(expect.any(Number));
  });

  it('refuses a step-up with a wrong code and issues no session', async () => {
    const enabled = { ...user, twoFactorSecret: 'stored', twoFactorEnabled: true };
    vi.mocked(prisma.user.findFirst).mockResolvedValue(enabled as never);
    vi.mocked(verifyTotp).mockResolvedValue(false);
    vi.mocked(prisma.twoFactorBackupCode.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.twoFactorBackupCode.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.refreshToken.create).mockClear();
    await expect(stepUpTwoFactor('user_1', '000000')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses disable when the role requires 2FA', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      twoFactorEnabled: true,
      twoFactorSecret: 'stored',
    } as never);
    await expect(disableTwoFactor('user_1', '123456')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects a wrong confirmation code', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      twoFactorSecret: 'stored',
    } as never);
    vi.mocked(verifyTotp).mockResolvedValue(false);
    await expect(confirmTwoFactorEnrolment('user_1', '000000')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('password reset', () => {
  it('does not reveal whether the email exists', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    await expect(requestPasswordReset('missing@example.com')).resolves.toBeUndefined();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('stores a hashed token and sends mail when the user exists', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({ id: 'reset_1' } as never);
    vi.mocked(sendMail).mockResolvedValue({ sent: false, reason: 'not_configured' });
    await requestPasswordReset('a@b.com');
    expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('leaves the reset token unused when the new password fails safety checks', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'reset_1',
      userId: user.id,
      usedAt: null,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      name: user.name,
      email: user.email,
    } as never);
    vi.mocked(assertNewPasswordAllowed).mockRejectedValue(new Error('weak password'));
    await expect(resetPassword('reset-token', 'weak')).rejects.toThrow('weak password');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
  });
});

describe('OTP reset security', () => {
  it('does not accept old unverified reset links', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'r',
      usedAt: null,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    } as never);
    await expect(resetPassword('legacy-link', 'LongStrong!Phrase97')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
  it('limits expired and exhausted OTP attempts without issuing a proof', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: 'r',
      attempts: 5,
      codeHash: '00'.repeat(32),
      expiresAt: new Date(Date.now() + 60000),
    } as never);
    await expect(verifyPasswordResetCode('a@b.com', '123456')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
  });
  it('increments failed OTP attempts without consuming a valid reset proof', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(prisma.passwordResetToken.findFirst).mockResolvedValue({
      id: 'r',
      attempts: 0,
      codeHash: '00'.repeat(32),
      expiresAt: new Date(Date.now() + 60000),
    } as never);
    await expect(verifyPasswordResetCode('a@b.com', '123456')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'r' },
      data: { attempts: { increment: 1 } },
    });
  });
  it('rejects an access token issued before password recovery', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      sessionsRevokedAt: new Date(),
    } as never);
    await expect(getUserAuthContext(user.id, Date.now() - 1000)).resolves.toBeNull();
  });
});

describe('credential issuance racing password reset', () => {
  it('rejects a password verified before a concurrent reset', async () => {
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(user as never)
      .mockResolvedValueOnce({
        ...user,
        passwordHash: 'new-password-hash',
        sessionsRevokedAt: new Date(),
      } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    await expect(login(user.email, 'old-password')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
  it('does not issue a challenge after credentials changed', async () => {
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      } as never)
      .mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
        sessionsRevokedAt: new Date(),
      } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    await expect(login(user.email, 'old-password')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('rejects a 2FA challenge checked before a concurrent reset', async () => {
    const snapshot = { ...user, twoFactorEnabled: true, twoFactorSecret: 'secret' };
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(snapshot as never)
      .mockResolvedValueOnce({
        ...snapshot,
        passwordHash: 'new-hash',
        sessionsRevokedAt: new Date(),
      } as never);
    vi.mocked(verifyTotp).mockResolvedValue(true);
    await expect(
      verifyTwoFactorLogin(signTwoFactorChallenge(user.id), '123456'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
  it('reloads refresh state under account lock and rejects a token revoked by reset', async () => {
    vi.mocked(prisma.refreshToken.findUnique)
      .mockResolvedValueOnce({ userId: user.id } as never)
      .mockResolvedValueOnce({
        id: 'old',
        userId: user.id,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      sessionsRevokedAt: new Date(),
    } as never);
    await expect(refreshSession('stolen-refresh')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id, revokedAt: null } }),
    );
  });
  it('rotates only a conditionally consumed active refresh token', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: 'old',
      userId: user.id,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      mfaVerifiedAt: null,
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 0 });
    await expect(refreshSession('old-refresh')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });
});

describe('backup code single use', () => {
  it('allows exactly one concurrent session for the same backup code', async () => {
    const snapshot = { ...user, twoFactorEnabled: true, twoFactorSecret: 'secret' };
    vi.mocked(prisma.user.findFirst).mockResolvedValue(snapshot as never);
    vi.mocked(verifyTotp).mockResolvedValue(false);
    // Both attempts observe an unused row; only the conditional claim wins.
    vi.mocked(prisma.twoFactorBackupCode.findMany).mockResolvedValue([
      { id: 'backup', codeHash: hashRefreshToken('abc123'), usedAt: null },
    ] as never);
    vi.mocked(prisma.twoFactorBackupCode.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const token = signTwoFactorChallenge(user.id);
    const results = await Promise.allSettled([
      verifyTwoFactorLogin(token, 'abc123'),
      verifyTwoFactorLogin(token, 'abc123'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(prisma.twoFactorBackupCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'backup', userId: user.id, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });
});
