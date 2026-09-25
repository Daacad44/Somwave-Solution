import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), updateMany: vi.fn() },
    twoFactorBackupCode: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock('../lib/password', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('../lib/totp', () => ({
  createTotpSecret: vi.fn(() => 'TESTSECRET'),
  totpUri: vi.fn(() => 'otpauth://totp/Somwave:a@b.com'),
  verifyTotp: vi.fn(),
}));

vi.mock('../lib/mailer', () => ({
  sendMail: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { verifyPassword } from '../lib/password';
import { verifyTotp } from '../lib/totp';
import { sendMail } from '../lib/mailer';
import {
  login,
  startTwoFactorEnrolment,
  confirmTwoFactorEnrolment,
  disableTwoFactor,
  regenerateBackupCodes,
  requestPasswordReset,
} from './auth.service';

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
  });

  it('disables 2FA after a valid code and clears the secret', async () => {
    const enabled = { ...user, twoFactorEnabled: true, twoFactorSecret: 'stored' };
    vi.mocked(prisma.user.findFirst)
      .mockResolvedValueOnce(enabled as never)
      .mockResolvedValueOnce({
        ...enabled,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      } as never);
    vi.mocked(verifyTotp).mockResolvedValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue(enabled as never);
    vi.mocked(prisma.twoFactorBackupCode.deleteMany).mockResolvedValue({ count: 2 } as never);
    const result = await disableTwoFactor('user_1', '123456');
    expect(result.twoFactorEnabled).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ twoFactorEnabled: false, twoFactorSecret: null }),
      }),
    );
  });

  it('rejects disable when 2FA is not enabled', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user as never);
    await expect(disableTwoFactor('user_1', '123456')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rotates backup codes after a valid authenticator code', async () => {
    const enabled = { ...user, twoFactorEnabled: true, twoFactorSecret: 'stored' };
    vi.mocked(prisma.user.findFirst).mockResolvedValue(enabled as never);
    vi.mocked(verifyTotp).mockResolvedValue(true);
    vi.mocked(prisma.twoFactorBackupCode.deleteMany).mockResolvedValue({ count: 8 } as never);
    vi.mocked(prisma.twoFactorBackupCode.createMany).mockResolvedValue({ count: 8 } as never);
    const result = await regenerateBackupCodes('user_1', '123456');
    expect(result.backupCodes).toHaveLength(8);
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
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({} as never);
    vi.mocked(sendMail).mockResolvedValue({ sent: false, reason: 'not_configured' });
    await requestPasswordReset('a@b.com');
    expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledOnce();
  });
});
