import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (work: unknown) =>
      Array.isArray(work) ? Promise.all(work) : (work as (tx: unknown) => Promise<unknown>)(prisma),
    ),
    user: { findFirst: vi.fn(), create: vi.fn() },
    engineerProfile: { upsert: vi.fn(), update: vi.fn() },
    engineerAccountInvitation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock('../lib/mailer', () => ({ sendMail: vi.fn(), emailReadiness: vi.fn() }));
vi.mock('../lib/env', () => ({
  env: {
    APP_PUBLIC_URL: 'https://app.somwave.botandev.com',
    EMAIL_SUPPORT: 'support@botandev.com',
  },
}));
vi.mock('../lib/password', () => ({
  hashPassword: vi.fn(async () => 'hashed-password'),
  verifyPassword: vi.fn(),
}));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('./notification-delivery.service', () => ({ emitNotification: vi.fn() }));

import { prisma } from '../lib/prisma';
import { emailReadiness, sendMail } from '../lib/mailer';
import { createEngineerAccount, engineerEmailReadiness } from './engineer-account.service';

const actor = { id: 'admin_1', roles: ['SUPER_ADMIN'] };
const input = {
  name: 'Ada Engineer',
  email: 'ada@example.com',
  jobTitle: 'Backend Engineer',
  specialization: 'Backend Engineer',
  skills: ['TypeScript'],
  experienceLevel: 'SENIOR' as const,
  employmentType: 'FULL_TIME' as const,
  weeklyCapacityHours: 40,
  availability: 'AVAILABLE' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(emailReadiness).mockReturnValue({ provider: 'resend', configured: true, missing: [] });
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ locked: '' }] as never);
  vi.mocked(prisma.user.findFirst)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      id: 'engineer_1',
      name: input.name,
      email: input.email,
      isActive: false,
      engineerProfile: { status: 'PENDING_VERIFICATION' },
      engineerAccountInvitation: { deliveryStatus: 'ACCEPTED', providerMessageId: 'resend_1' },
    } as never);
  vi.mocked(prisma.user.create).mockResolvedValue({
    id: 'engineer_1',
    name: input.name,
    email: input.email,
  } as never);
  vi.mocked(prisma.engineerAccountInvitation.update).mockResolvedValue({} as never);
  vi.mocked(prisma.engineerProfile.update).mockResolvedValue({} as never);
});

describe('engineer registration with Resend', () => {
  it('returns configuration names only when Resend is unavailable', async () => {
    vi.mocked(emailReadiness).mockReturnValue({
      provider: 'resend',
      configured: false,
      missing: ['RESEND_API_KEY'],
    });
    expect(engineerEmailReadiness(actor)).toEqual({
      provider: 'resend',
      configured: false,
      missing: ['RESEND_API_KEY'],
    });
    await expect(createEngineerAccount(actor, input)).rejects.toMatchObject({
      status: 503,
      message: 'Engineer invitation email is not configured: RESEND_API_KEY',
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(() => engineerEmailReadiness({ id: 'engineer_1', roles: ['ENGINEER'] })).toThrow();
  });

  it('records Resend acceptance and the provider message ID without activating the account', async () => {
    vi.mocked(sendMail).mockResolvedValue({ sent: true, providerMessageId: 'resend_1' });
    const result = await createEngineerAccount(actor, input);
    expect(result).toMatchObject({
      id: 'engineer_1',
      isActive: false,
      profile: { status: 'PENDING_VERIFICATION' },
      engineerAccountInvitation: { deliveryStatus: 'ACCEPTED', providerMessageId: 'resend_1' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: input.email,
        template: 'engineer-account-invite.v1',
        idempotencyKey: expect.stringMatching(/^engineer-invite:engineer_1:[a-f0-9]{64}$/),
        vars: expect.objectContaining({
          setupUrl: expect.stringMatching(
            /^https:\/\/app\.somwave\.botandev\.com\/activate-engineer\?token=/,
          ),
        }),
      }),
    );
    expect(prisma.engineerAccountInvitation.update).toHaveBeenCalledWith({
      where: { userId: 'engineer_1' },
      data: { deliveryStatus: 'ACCEPTED', providerMessageId: 'resend_1' },
    });
  });

  it('records provider rejection without granting engineer access', async () => {
    vi.mocked(sendMail).mockResolvedValue({ sent: false, reason: 'invalid_credentials' });
    await expect(createEngineerAccount(actor, input)).rejects.toMatchObject({ status: 503 });
    expect(prisma.engineerAccountInvitation.update).toHaveBeenCalledWith({
      where: { userId: 'engineer_1' },
      data: { deliveryStatus: 'FAILED', providerMessageId: null },
    });
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects an existing invitation before sending another email', async () => {
    vi.mocked(prisma.user.findFirst)
      .mockReset()
      .mockResolvedValue({
        id: 'engineer_1',
        deletedAt: null,
        isActive: false,
        engineerAccountInvitation: { status: 'INVITED' },
        roles: [],
        engineerProfile: { status: 'INVITED' },
      } as never);
    await expect(createEngineerAccount(actor, input)).rejects.toMatchObject({ status: 409 });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
