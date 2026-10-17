import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({
  prisma: {
    role: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    userInvitation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../lib/mailer', () => ({
  emailReadiness: vi.fn(() => ({ configured: true })),
  sendMail: vi.fn(async () => ({ sent: true })),
}));
vi.mock('../lib/env', () => ({ env: { APP_PUBLIC_URL: 'https://app.example.com' } }));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn() }));
vi.mock('../lib/password-policy', () => ({ assertNewPasswordAllowed: vi.fn() }));
vi.mock('../lib/password', () => ({ hashPassword: vi.fn(async () => 'hashed') }));
import { prisma } from '../lib/prisma';
import { hashRefreshToken } from '../lib/tokens';
import { sendMail } from '../lib/mailer';
import {
  activateInvitation,
  inviteUser,
  manageInvitation,
  verifyInvitation,
} from './user-invitation.service';
import type { AuthUser } from '@somwave/shared';
const actor = { id: 'admin', roles: ['ADMIN'] } as AuthUser;
const invitation = {
  id: 'i1',
  email: 'new@example.com',
  name: 'New User',
  roleIds: ['r1'],
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 3600000),
  createdAt: new Date(),
  updatedAt: new Date(Date.now() - 120000),
  tokenHash: 'hash',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: 'r1', name: 'ENGINEER' }] as never);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.userInvitation.upsert).mockResolvedValue(invitation as never);
});
describe('generic invitations', () => {
  it('sends a link without creating an active user or returning the token', async () => {
    const result = await inviteUser(
      { name: 'New User', email: 'NEW@example.com', roleIds: ['r1'] },
      actor,
    );
    expect(result.email).toBe('new@example.com');
    expect(result).not.toHaveProperty('tokenHash');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        vars: expect.objectContaining({
          setupUrl: expect.stringMatching(
            /^https:\/\/app.example.com\/activate-account\?token=[a-f0-9]{64}$/,
          ),
        }),
      }),
    );
  });
  it('prevents administrators inviting super administrators', async () => {
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ id: 'r1', name: 'SUPER_ADMIN' }] as never);
    await expect(
      inviteUser({ name: 'User', email: 'new@example.com', roleIds: ['r1'] }, actor),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.userInvitation.upsert).not.toHaveBeenCalled();
  });
  it('rejects a duplicate account and pending invitation', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing' } as never);
    await expect(
      inviteUser({ name: 'User', email: 'new@example.com', roleIds: ['r1'] }, actor),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'new@example.com', mode: 'insensitive' } },
    });
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(invitation as never);
    await expect(
      inviteUser({ name: 'User', email: 'new@example.com', roleIds: ['r1'] }, actor),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('rejects expired and cancelled activation tokens', async () => {
    vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
      ...invitation,
      status: 'CANCELLED',
    } as never);
    await expect(verifyInvitation('secret')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
      ...invitation,
      expiresAt: new Date(0),
    } as never);
    await expect(verifyInvitation('secret')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('rolls back concurrent repeated activation before user creation', async () => {
    vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(invitation as never);
    vi.mocked(prisma.userInvitation.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma) as never,
    );
    await expect(activateInvitation('secret', 'Powerful#Phrase123')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.userInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tokenHash: hashRefreshToken('secret') }),
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it('enforces resend cooldown', async () => {
    vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
      ...invitation,
      updatedAt: new Date(),
    } as never);
    await expect(manageInvitation('i1', 'resend', actor)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });
});
