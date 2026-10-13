import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    engineerAccountInvitation: { findUnique: vi.fn(), updateMany: vi.fn() },
    engineerProfile: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    role: { findUnique: vi.fn() },
    $transaction: vi.fn(async (calls: unknown) =>
      Array.isArray(calls) ? Promise.all(calls) : undefined,
    ),
  },
}));
vi.mock('../lib/password', () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));

import { prisma } from '../lib/prisma';
import { verifyPassword } from '../lib/password';
import {
  verifyEngineerInvitation,
  activateEngineerInvitation,
  requestEngineerVerificationResend,
} from './engineer-account.service';

const user = {
  id: 'engineer_1',
  name: 'Ada Engineer',
  email: 'ada@example.com',
  passwordHash: 'existing-password-hash',
  engineerProfile: {
    jobTitle: 'Backend Engineer',
    specialization: 'Backend Engineer',
    experienceLevel: 'SENIOR',
    employmentType: 'FULL_TIME',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.engineerProfile.update).mockResolvedValue({} as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
});

describe('engineer account invitation verification', () => {
  it('rejects an unknown token without changing account state', async () => {
    vi.mocked(prisma.engineerAccountInvitation.findUnique).mockResolvedValue(null);
    await expect(verifyEngineerInvitation('unknown-token')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.engineerAccountInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an expired token without changing account state', async () => {
    vi.mocked(prisma.engineerAccountInvitation.findUnique).mockResolvedValue({
      id: 'invite_1',
      userId: user.id,
      status: 'INVITED',
      expiresAt: new Date(Date.now() - 1),
      user,
    } as never);
    await expect(verifyEngineerInvitation('expired-token')).rejects.toMatchObject({ status: 410 });
    expect(prisma.engineerAccountInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('consumes the verification token atomically and returns a separate activation token', async () => {
    vi.mocked(prisma.engineerAccountInvitation.findUnique).mockResolvedValue({
      id: 'invite_1',
      userId: user.id,
      status: 'INVITED',
      wasExistingUser: false,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    } as never);
    vi.mocked(prisma.engineerAccountInvitation.updateMany).mockResolvedValue({ count: 1 });
    const result = await verifyEngineerInvitation('single-use-token');
    expect(result.activationToken).toBeTruthy();
    expect(result.activationToken).not.toBe('single-use-token');
    expect(prisma.engineerAccountInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'INVITED' }),
        data: expect.objectContaining({
          status: 'VERIFIED',
          activationTokenHash: expect.any(String),
        }),
      }),
    );
  });

  it('never grants a role to an existing account with an incorrect password', async () => {
    vi.mocked(prisma.engineerAccountInvitation.findUnique).mockResolvedValue({
      id: 'invite_1',
      userId: user.id,
      status: 'VERIFIED',
      wasExistingUser: true,
      activationExpiresAt: new Date(Date.now() + 60_000),
      user,
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    await expect(
      activateEngineerInvitation({
        activationToken: 'activation-token',
        password: 'incorrect-password',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not disclose whether a resend address has an invitation', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    await expect(requestEngineerVerificationResend('unknown@example.com')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.engineerAccountInvitation.findUnique).not.toHaveBeenCalled();
  });
});
