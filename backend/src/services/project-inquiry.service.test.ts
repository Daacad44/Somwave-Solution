import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-with-at-least-thirty-two-characters',
    EMAIL_FROM: 'Somwave Solution <noreply@botandev.com>',
    PROJECT_INQUIRY_CODE_TTL_MINUTES: 10,
  },
}));
vi.mock('../lib/prisma', () => {
  const db = {
    projectInquiry: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    portfolioItem: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    role: { findUnique: vi.fn() },
    client: { findFirst: vi.fn(), create: vi.fn() },
    project: { create: vi.fn() },
  };
  return {
    prisma: {
      ...db,
      $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
    },
  };
});
vi.mock('../lib/mailer', () => ({
  emailReadiness: vi.fn(() => ({ configured: true, missing: [] })),
  sendMail: vi.fn(async () => ({ sent: true })),
}));
vi.mock('../lib/notify', () => ({ notifyUsersWithPermission: vi.fn(async () => {}) }));
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
vi.mock('../lib/password-policy', () => ({ assertNewPasswordAllowed: vi.fn(async () => {}) }));
vi.mock('../lib/password', () => ({ hashPassword: vi.fn(async () => 'hashed-password') }));

import { prisma } from '../lib/prisma';
import { sendMail } from '../lib/mailer';
import { hashPassword } from '../lib/password';
import {
  createProjectInquiry,
  verifyProjectInquiry,
  resendProjectInquiryCode,
  activateProjectInquiry,
  listClientProjectInquiries,
  listUnlinkedProjectInquiries,
  linkProjectInquiry,
  approveProjectInquiryProposal,
  convertProjectInquiry,
} from './project-inquiry.service';

const input = {
  name: 'Ayaan',
  email: 'ayaan@example.com',
  projectType: 'Website',
  description: 'Build a professional website',
  desiredFeatures: ['CMS'],
};
const now = new Date();
const base = {
  id: 'inq-1',
  idempotencyKey: 'request-key-at-least-16',
  ...input,
  phone: null,
  companyName: null,
  portfolioItemId: null,
  estimatedBudget: null,
  expectedTimeline: null,
  status: 'PENDING_VERIFICATION' as const,
  verificationCodeHash: null,
  verificationExpiresAt: null,
  verificationAttempts: 0,
  verificationSends: 0,
  verificationSentAt: null,
  emailVerifiedAt: null,
  activationTokenHash: null,
  activationExpiresAt: null,
  userId: null,
  clientId: null,
  projectId: null,
  proposalSummary: null,
  createdAt: now,
  updatedAt: now,
};

beforeEach(() => vi.clearAllMocks());

describe('project request verification', () => {
  it('creates a pending request and sends a six-digit code without exposing it', async () => {
    vi.mocked(prisma.projectInquiry.findUnique)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(base as never);
    vi.mocked(prisma.projectInquiry.create).mockResolvedValue(base as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await createProjectInquiry(input, base.idempotencyKey);
    expect(result).toEqual({
      id: base.id,
      status: 'PENDING_VERIFICATION',
      verificationRequired: true,
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: input.email,
        vars: expect.objectContaining({ code: expect.stringMatching(/^\d{6}$/) }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(vi.mocked(sendMail).mock.calls[0]![0].vars.code);
  });

  it('rejects a changed payload that reuses the same idempotency key', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue(base as never);
    await expect(
      createProjectInquiry(
        { ...input, description: 'A different project request' },
        base.idempotencyKey,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectInquiry.create).not.toHaveBeenCalled();
  });

  it('enforces the resend cooldown before sending again', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      verificationSentAt: new Date(),
    } as never);
    await expect(resendProjectInquiryCode(base.id)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('releases the send reservation when Resend rejects the message', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue(base as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(sendMail).mockResolvedValueOnce({ sent: false, reason: 'failed' });
    await expect(resendProjectInquiryCode(base.id)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(prisma.projectInquiry.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationSentAt: null,
          verificationSends: { decrement: 1 },
          verificationCodeHash: null,
        }),
      }),
    );
  });

  it('increments failed attempts and refuses an exhausted code', async () => {
    const code = '123456';
    const hash = createHmac('sha256', 'test-secret-with-at-least-thirty-two-characters')
      .update(`project-inquiry:${base.id}:${code}`)
      .digest('hex');
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      verificationCodeHash: hash,
      verificationExpiresAt: new Date(Date.now() + 60_000),
      verificationAttempts: 4,
    } as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
    await expect(verifyProjectInquiry(base.id, '000000')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { verificationAttempts: { increment: 1 } },
        where: expect.objectContaining({ verificationAttempts: { lt: 5 } }),
      }),
    );
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      verificationCodeHash: hash,
      verificationExpiresAt: new Date(Date.now() + 60_000),
      verificationAttempts: 5,
    } as never);
    await expect(verifyProjectInquiry(base.id, code)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('consumes a valid code once and returns a separate activation proof', async () => {
    const code = '123456';
    const hash = createHmac('sha256', 'test-secret-with-at-least-thirty-two-characters')
      .update(`project-inquiry:${base.id}:${code}`)
      .digest('hex');
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      verificationCodeHash: hash,
      verificationExpiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const result = await verifyProjectInquiry(base.id, code);
    expect(result.status).toBe('EMAIL_VERIFIED');
    expect(result.activationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verificationCodeHash: null, status: 'EMAIL_VERIFIED' }),
      }),
    );
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(verifyProjectInquiry(base.id, code)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('returns upload proof after verification even when an account already exists', async () => {
    const code = '123456';
    const hash = createHmac('sha256', 'test-secret-with-at-least-thirty-two-characters')
      .update(`project-inquiry:${base.id}:${code}`)
      .digest('hex');
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      verificationCodeHash: hash,
      verificationExpiresAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing-user' } as never);
    const result = await verifyProjectInquiry(base.id, code);
    expect(result.accountExists).toBe(true);
    expect(result.activationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('requires activation proof before hashing a password', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      status: 'EMAIL_VERIFIED',
      emailVerifiedAt: now,
      activationTokenHash: 'a'.repeat(64),
      activationExpiresAt: new Date(Date.now() + 60_000),
    } as never);
    await expect(
      activateProjectInquiry(base.id, 'wrong-token', 'Abcdefgh!1234'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('creates only a CLIENT account and consumes a valid activation proof', async () => {
    const token = 'valid-activation-token';
    const hash = createHash('sha256').update(token).digest('hex');
    const verified = {
      ...base,
      status: 'EMAIL_VERIFIED' as const,
      emailVerifiedAt: now,
      activationTokenHash: hash,
      activationExpiresAt: new Date(Date.now() + 60_000),
    };
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue(verified as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.role.findUnique).mockResolvedValue({ id: 'client-role' } as never);
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.client.create).mockResolvedValue({ id: 'client-1' } as never);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
    const result = await activateProjectInquiry(base.id, token, 'Abcdefgh!1234');
    expect(result.status).toBe('ACCOUNT_CREATED');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          roles: { create: { roleId: 'client-role' } },
        }),
      }),
    );
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ activationTokenHash: null, activationExpiresAt: null }),
      }),
    );
  });
});

describe('client ownership and conversion', () => {
  it('lists only client-scoped linked inquiries', async () => {
    vi.mocked(prisma.projectInquiry.findMany).mockResolvedValue([
      { ...base, clientId: 'client-1', status: 'ACCOUNT_CREATED' },
    ] as never);
    const result = await listClientProjectInquiries('client-1');
    expect(result).toHaveLength(1);
    expect(prisma.projectInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1' },
      }),
    );
  });

  it('finds unlinked verified requests only for the signed-in client email', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'user-1',
      email: input.email,
      clientId: 'client-1',
      roles: [{ role: { name: 'CLIENT' } }],
    } as never);
    vi.mocked(prisma.projectInquiry.findMany).mockResolvedValue([base] as never);
    await listUnlinkedProjectInquiries('user-1');
    expect(prisma.projectInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: input.email, mode: 'insensitive' },
          status: 'EMAIL_VERIFIED',
          userId: null,
        }),
      }),
    );
  });

  it('links only a verified inquiry with the same email as a client user', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'user-1',
      email: input.email,
      clientId: 'client-1',
      roles: [{ role: { name: 'CLIENT' } }],
    } as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(linkProjectInquiry(base.id, 'user-1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: input.email, mode: 'insensitive' },
          status: 'EMAIL_VERIFIED',
          userId: null,
        }),
      }),
    );
  });

  it('allows proposal approval only for the owning client', async () => {
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(
      approveProjectInquiryProposal(base.id, 'other-client', 'user-2'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'other-client', status: 'PROPOSAL_SENT' }),
      }),
    );
  });

  it('never creates a project before client proposal approval', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      status: 'UNDER_REVIEW',
      clientId: 'client-1',
    } as never);
    await expect(convertProjectInquiry(base.id, 'admin-1')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('converts an approved request exactly once into a client-owned planning project', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...base,
      status: 'APPROVED',
      clientId: 'client-1',
      userId: 'user-1',
      companyName: 'Example Ltd',
    } as never);
    vi.mocked(prisma.project.create).mockResolvedValue({ id: 'project-1' } as never);
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
    const result = await convertProjectInquiry(base.id, 'admin-1');
    expect(result).toEqual({ projectId: 'project-1', created: true });
    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Example Ltd — Website',
          clientId: 'client-1',
          status: 'PLANNING',
        }),
      }),
    );
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: base.id, status: 'APPROVED', projectId: null },
        data: { status: 'CONVERTED', projectId: 'project-1' },
      }),
    );
  });
});
