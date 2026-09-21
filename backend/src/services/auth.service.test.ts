import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn() },
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

import { prisma } from '../lib/prisma';
import { verifyPassword } from '../lib/password';
import { verifyTotp } from '../lib/totp';
import { login, startTwoFactorEnrolment, confirmTwoFactorEnrolment } from './auth.service';

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

  it('enables 2FA after a valid confirmation code', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      ...user,
      twoFactorSecret: 'stored',
    } as never);
    vi.mocked(verifyTotp).mockResolvedValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...user, twoFactorEnabled: true } as never);
    const result = await confirmTwoFactorEnrolment('user_1', '123456');
    expect(result.twoFactorEnabled).toBe(true);
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
