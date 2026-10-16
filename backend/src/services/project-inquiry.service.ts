import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma, type ProjectInquiry } from '@prisma/client';
import type {
  CreateProjectInquiryInput,
  ProjectInquirySummary,
  ProjectInquiryStatus,
} from '@somwave/shared';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { env } from '../lib/env';
import { emailReadiness, sendMail } from '../lib/mailer';
import { PROJECT_INQUIRY_VERIFY_V1 } from '../mail/templates';
import { assertNewPasswordAllowed } from '../lib/password-policy';
import { hashPassword } from '../lib/password';
import { notifyUsersWithPermission } from '../lib/notify';
import { writeAudit } from '../lib/audit';
import { hashRefreshToken } from '../lib/tokens';
import { emitNotification } from './notification-delivery.service';
import { logger } from '../lib/logger';

const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
const RESEND_COOLDOWN_MS = 60_000;

function summary(row: ProjectInquiry): ProjectInquirySummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    companyName: row.companyName,
    projectType: row.projectType,
    portfolioItemId: row.portfolioItemId,
    description: row.description,
    desiredFeatures: row.desiredFeatures,
    estimatedBudget: row.estimatedBudget,
    expectedTimeline: row.expectedTimeline,
    status: row.status,
    projectId: row.projectId,
    proposalSummary: row.proposalSummary,
    createdAt: row.createdAt.toISOString(),
  };
}

function codeHash(id: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`project-inquiry:${id}:${code}`).digest('hex');
}

function assertMailReady(): void {
  const readiness = emailReadiness();
  if (!readiness.configured) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      `Project inquiry verification email is not configured: ${readiness.missing.join(', ')}`,
    );
  }
  if (env.EMAIL_FROM !== 'Somwave Solution <noreply@botandev.com>') {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      'Project inquiry verification requires EMAIL_FROM=Somwave Solution <noreply@botandev.com>',
    );
  }
}

function sameSubmission(row: ProjectInquiry, input: CreateProjectInquiryInput): boolean {
  return (
    row.name === input.name &&
    row.email === input.email &&
    row.phone === (input.phone || null) &&
    row.companyName === (input.companyName || null) &&
    row.projectType === input.projectType &&
    row.portfolioItemId === (input.portfolioItemId || null) &&
    row.description === input.description &&
    JSON.stringify(row.desiredFeatures) === JSON.stringify(input.desiredFeatures ?? []) &&
    row.estimatedBudget === (input.estimatedBudget || null) &&
    row.expectedTimeline === (input.expectedTimeline || null)
  );
}

async function sendVerification(id: string): Promise<void> {
  assertMailReady();
  const row = await prisma.projectInquiry.findUnique({ where: { id } });
  if (!row || row.status !== 'PENDING_VERIFICATION') {
    throw new AppError('CONFLICT', 409, 'This request is already verified or unavailable');
  }
  if (row.verificationSends >= MAX_SENDS) {
    throw new AppError('RATE_LIMITED', 429, 'Too many verification emails. Contact support.');
  }
  const now = new Date();
  if (
    row.verificationSentAt &&
    now.getTime() - row.verificationSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new AppError('RATE_LIMITED', 429, 'Please wait before requesting another code');
  }
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const hash = codeHash(id, code);
  const expiresAt = new Date(now.getTime() + env.PROJECT_INQUIRY_CODE_TTL_MINUTES * 60_000);
  const reserved = await prisma.projectInquiry.updateMany({
    where: {
      id,
      status: 'PENDING_VERIFICATION',
      verificationSends: { lt: MAX_SENDS },
      OR: [
        { verificationSentAt: null },
        { verificationSentAt: { lt: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
      ],
    },
    data: {
      verificationCodeHash: hash,
      verificationExpiresAt: expiresAt,
      verificationAttempts: 0,
      verificationSentAt: now,
      verificationSends: { increment: 1 },
    },
  });
  if (reserved.count !== 1)
    throw new AppError('RATE_LIMITED', 429, 'Please wait before requesting another code');
  const sent = await sendMail({
    to: row.email,
    template: PROJECT_INQUIRY_VERIFY_V1,
    vars: { name: row.name, code, minutes: String(env.PROJECT_INQUIRY_CODE_TTL_MINUTES) },
    idempotencyKey: `project-inquiry-code:${id}:${hash}`,
  });
  if (!sent.sent) {
    await prisma.projectInquiry.updateMany({
      where: { id, verificationCodeHash: hash, status: 'PENDING_VERIFICATION' },
      data: {
        verificationCodeHash: null,
        verificationExpiresAt: null,
        verificationSentAt: null,
        verificationSends: { decrement: 1 },
      },
    });
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      503,
      'Verification email could not be sent. Please retry shortly.',
    );
  }
}

export async function createProjectInquiry(input: CreateProjectInquiryInput, key: string) {
  if (input.website)
    return { id: 'ignored', status: 'PENDING_VERIFICATION' as const, verificationRequired: true };
  if (!/^[\w:-]{16,120}$/.test(key))
    throw new AppError('VALIDATION_ERROR', 400, 'Valid Idempotency-Key header required');
  assertMailReady();
  if (input.portfolioItemId) {
    const item = await prisma.portfolioItem.findFirst({
      where: { id: input.portfolioItemId, isPublished: true, isArchived: false },
      select: { id: true },
    });
    if (!item)
      throw new AppError('VALIDATION_ERROR', 400, 'Referenced portfolio project is unavailable');
  }
  let row = await prisma.projectInquiry.findUnique({ where: { idempotencyKey: key } });
  if (row && !sameSubmission(row, input))
    throw new AppError('CONFLICT', 409, 'Idempotency key is already in use');
  if (!row) {
    try {
      row = await prisma.projectInquiry.create({
        data: {
          idempotencyKey: key,
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          companyName: input.companyName || null,
          projectType: input.projectType,
          portfolioItemId: input.portfolioItemId || null,
          description: input.description,
          desiredFeatures: input.desiredFeatures ?? [],
          estimatedBudget: input.estimatedBudget || null,
          expectedTimeline: input.expectedTimeline || null,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
        throw error;
      row = await prisma.projectInquiry.findUnique({ where: { idempotencyKey: key } });
      if (!row || !sameSubmission(row, input))
        throw new AppError('CONFLICT', 409, 'Idempotency key is already in use');
    }
  }
  if (row.status === 'PENDING_VERIFICATION' && !row.verificationSentAt)
    await sendVerification(row.id);
  return {
    id: row.id,
    status: row.status,
    verificationRequired: row.status === 'PENDING_VERIFICATION',
  };
}

export async function resendProjectInquiryCode(id: string): Promise<{ sent: true }> {
  await sendVerification(id);
  return { sent: true };
}

export async function verifyProjectInquiry(id: string, code: string) {
  const row = await prisma.projectInquiry.findUnique({ where: { id } });
  const now = new Date();
  if (
    !row ||
    row.status !== 'PENDING_VERIFICATION' ||
    !row.verificationCodeHash ||
    !row.verificationExpiresAt ||
    row.verificationExpiresAt <= now ||
    row.verificationAttempts >= MAX_ATTEMPTS
  ) {
    throw new AppError('VALIDATION_ERROR', 400, 'Code expired or unavailable. Request a new one.');
  }
  const supplied = Buffer.from(codeHash(id, code), 'hex');
  const expected = Buffer.from(row.verificationCodeHash, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    await prisma.projectInquiry.updateMany({
      where: {
        id,
        status: 'PENDING_VERIFICATION',
        verificationCodeHash: row.verificationCodeHash,
        verificationAttempts: { lt: MAX_ATTEMPTS },
      },
      data: { verificationAttempts: { increment: 1 } },
    });
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }
  const activationToken = randomBytes(32).toString('base64url');
  const consumed = await prisma.projectInquiry.updateMany({
    where: {
      id,
      status: 'PENDING_VERIFICATION',
      verificationCodeHash: row.verificationCodeHash,
      verificationExpiresAt: { gt: now },
      verificationAttempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: 'EMAIL_VERIFIED',
      emailVerifiedAt: now,
      verificationCodeHash: null,
      verificationExpiresAt: null,
      verificationAttempts: 0,
      activationTokenHash: hashRefreshToken(activationToken),
      activationExpiresAt: new Date(now.getTime() + 30 * 60_000),
    },
  });
  if (consumed.count !== 1) throw new AppError('CONFLICT', 409, 'Code was already used');
  const existing = await prisma.user.findFirst({
    where: { email: { equals: row.email, mode: 'insensitive' } },
    select: { id: true },
  });
  await Promise.allSettled([
    notifyUsersWithPermission(
      PERMISSIONS.LEADS_READ,
      'Verified project request',
      `${row.name} submitted a project request.`,
    ),
    writeAudit({
      actorId: null,
      action: 'project-inquiry.verify',
      subjectType: 'ProjectInquiry',
      subjectId: id,
    }),
  ]);
  return {
    status: 'EMAIL_VERIFIED' as const,
    accountExists: Boolean(existing),
    activationToken,
  };
}

export async function activateProjectInquiry(
  id: string,
  activationToken: string,
  password: string,
) {
  const row = await prisma.projectInquiry.findUnique({ where: { id } });
  if (
    !row ||
    row.status !== 'EMAIL_VERIFIED' ||
    !row.emailVerifiedAt ||
    !row.activationTokenHash ||
    !row.activationExpiresAt ||
    row.activationExpiresAt <= new Date()
  ) {
    throw new AppError('CONFLICT', 409, 'Verify this request first');
  }
  const actualHash = Buffer.from(hashRefreshToken(activationToken), 'hex');
  const expectedHash = Buffer.from(row.activationTokenHash, 'hex');
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
    throw new AppError('FORBIDDEN', 403, 'Invalid activation proof');
  }
  await assertNewPasswordAllowed(password, { name: row.name, email: row.email });
  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.projectInquiry.findUnique({ where: { id } });
      if (
        !current ||
        current.status !== 'EMAIL_VERIFIED' ||
        !current.emailVerifiedAt ||
        current.activationTokenHash !== row.activationTokenHash ||
        !current.activationExpiresAt ||
        current.activationExpiresAt <= new Date()
      ) {
        throw new AppError('CONFLICT', 409, 'This request has already been activated');
      }
      const existingUser = await tx.user.findFirst({
        where: { email: { equals: current.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingUser)
        throw new AppError('CONFLICT', 409, 'An account exists. Sign in to link this request.');
      const role = await tx.role.findUnique({
        where: { name: ROLES.CLIENT },
        select: { id: true },
      });
      if (!role) throw new AppError('SERVICE_UNAVAILABLE', 503, 'Client role is not configured');
      const client =
        (await tx.client.findFirst({
          where: { email: { equals: current.email, mode: 'insensitive' }, deletedAt: null },
          select: { id: true },
        })) ??
        (await tx.client.create({
          data: {
            companyName: current.companyName || current.name,
            email: current.email,
            phone: current.phone,
            status: 'ACTIVE',
          },
          select: { id: true },
        }));
      const user = await tx.user.create({
        data: {
          name: current.name,
          email: current.email,
          passwordHash,
          clientId: client.id,
          roles: { create: { roleId: role.id } },
        },
        select: { id: true },
      });
      const updated = await tx.projectInquiry.updateMany({
        where: {
          id,
          status: 'EMAIL_VERIFIED',
          userId: null,
          activationTokenHash: row.activationTokenHash,
          activationExpiresAt: { gt: new Date() },
        },
        data: {
          status: 'ACCOUNT_CREATED',
          userId: user.id,
          clientId: client.id,
          activationTokenHash: null,
          activationExpiresAt: null,
        },
      });
      if (updated.count !== 1)
        throw new AppError('CONFLICT', 409, 'This request has already been activated');
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('CONFLICT', 409, 'An account exists. Sign in to link this request.');
    }
    throw error;
  }
  await writeAudit({
    actorId: null,
    action: 'project-inquiry.activate',
    subjectType: 'ProjectInquiry',
    subjectId: id,
  });
  return { status: 'ACCOUNT_CREATED' as const, loginUrl: '/login' };
}

export async function linkProjectInquiry(id: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    include: { roles: { include: { role: true } } },
  });
  if (!user || !user.roles.some((r) => r.role.name === ROLES.CLIENT) || !user.clientId) {
    throw new AppError('FORBIDDEN', 403, 'A client account is required');
  }
  const changed = await prisma.projectInquiry.updateMany({
    where: {
      id,
      email: { equals: user.email, mode: 'insensitive' },
      emailVerifiedAt: { not: null },
      status: 'EMAIL_VERIFIED',
      userId: null,
    },
    data: {
      status: 'ACCOUNT_CREATED',
      userId: user.id,
      clientId: user.clientId,
      activationTokenHash: null,
      activationExpiresAt: null,
    },
  });
  if (changed.count !== 1)
    throw new AppError('CONFLICT', 409, 'Verified request unavailable for this account');
  return { status: 'ACCOUNT_CREATED' as const };
}

export async function listClientProjectInquiries(
  clientId: string,
): Promise<ProjectInquirySummary[]> {
  const rows = await prisma.projectInquiry.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(summary);
}

export async function listUnlinkedProjectInquiries(
  userId: string,
): Promise<ProjectInquirySummary[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    include: { roles: { include: { role: true } } },
  });
  if (!user || !user.clientId || !user.roles.some((r) => r.role.name === ROLES.CLIENT)) {
    throw new AppError('FORBIDDEN', 403, 'Client account required');
  }
  const rows = await prisma.projectInquiry.findMany({
    where: {
      email: { equals: user.email, mode: 'insensitive' },
      status: 'EMAIL_VERIFIED',
      emailVerifiedAt: { not: null },
      userId: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  return rows.map(summary);
}

export async function listAdminProjectInquiries(): Promise<ProjectInquirySummary[]> {
  const rows = await prisma.projectInquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map(summary);
}

export async function reviewProjectInquiry(
  id: string,
  status: 'UNDER_REVIEW' | 'PROPOSAL_SENT' | 'REJECTED' | 'CANCELLED',
  actorId: string,
  proposalSummary?: string,
): Promise<ProjectInquirySummary> {
  const row = await prisma.projectInquiry.findUnique({ where: { id } });
  if (!row || !row.clientId || !row.userId)
    throw new AppError('CONFLICT', 409, 'Client account must be linked first');
  const allowed: Record<string, ProjectInquiryStatus[]> = {
    UNDER_REVIEW: ['ACCOUNT_CREATED', 'PROPOSAL_SENT'],
    PROPOSAL_SENT: ['UNDER_REVIEW'],
    REJECTED: ['ACCOUNT_CREATED', 'UNDER_REVIEW', 'PROPOSAL_SENT'],
    CANCELLED: ['ACCOUNT_CREATED', 'UNDER_REVIEW', 'PROPOSAL_SENT'],
  };
  if (!allowed[status]?.includes(row.status))
    throw new AppError('CONFLICT', 409, 'Invalid inquiry status transition');
  if (status === 'PROPOSAL_SENT' && (!proposalSummary || proposalSummary.length < 20)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Proposal summary is required');
  }
  const updated = await prisma.projectInquiry.updateMany({
    where: { id, status: row.status },
    data: { status, ...(status === 'PROPOSAL_SENT' ? { proposalSummary } : {}) },
  });
  if (updated.count !== 1) throw new AppError('CONFLICT', 409, 'Request changed; reload and retry');
  await writeAudit({
    actorId,
    action: `project-inquiry.${status.toLowerCase()}`,
    subjectType: 'ProjectInquiry',
    subjectId: id,
  });
  try {
    await emitNotification({
      eventKey: 'project.inquiry',
      userId: row.userId,
      title: status === 'PROPOSAL_SENT' ? 'Project proposal ready' : 'Project request updated',
      body:
        status === 'PROPOSAL_SENT'
          ? 'A proposal for your project request is ready to review in the Client Portal.'
          : `Your project request is now ${status.toLowerCase().replace('_', ' ')}.`,
      dedupeKey: `project-inquiry:${id}:${status}:${row.updatedAt.toISOString()}`,
      requiredEmail: status === 'PROPOSAL_SENT',
    });
  } catch (error) {
    logger.warn(
      { inquiryId: id, errorName: error instanceof Error ? error.name : 'unknown' },
      'Project inquiry notification could not be queued',
    );
  }
  return summary(await prisma.projectInquiry.findUniqueOrThrow({ where: { id } }));
}

export async function approveProjectInquiryProposal(id: string, clientId: string, actorId: string) {
  const changed = await prisma.projectInquiry.updateMany({
    where: { id, clientId, status: 'PROPOSAL_SENT', proposalSummary: { not: null } },
    data: { status: 'APPROVED' },
  });
  if (changed.count !== 1)
    throw new AppError('CONFLICT', 409, 'No proposal is awaiting your approval');
  await writeAudit({
    actorId,
    action: 'project-inquiry.proposal.accept',
    subjectType: 'ProjectInquiry',
    subjectId: id,
  });
  await notifyUsersWithPermission(
    PERMISSIONS.LEADS_READ,
    'Project proposal accepted',
    `A client approved project request ${id}.`,
  );
  return summary(await prisma.projectInquiry.findUniqueOrThrow({ where: { id } }));
}

export async function convertProjectInquiry(
  id: string,
  actorId: string,
  managerId?: string | null,
) {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.projectInquiry.findUnique({ where: { id } });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Project request not found');
    if (row.status === 'CONVERTED' && row.projectId)
      return { projectId: row.projectId, created: false };
    if (row.status !== 'APPROVED' || !row.clientId)
      throw new AppError('CONFLICT', 409, 'Client approval and account are required');
    if (managerId) {
      const manager = await tx.user.findFirst({
        where: {
          id: managerId,
          isActive: true,
          deletedAt: null,
          roles: {
            some: {
              role: {
                name: {
                  in: [ROLES.PROJECT_MANAGER, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!manager) throw new AppError('VALIDATION_ERROR', 400, 'Project manager not found');
    }
    const project = await tx.project.create({
      data: {
        name: `${row.companyName || row.name} — ${row.projectType}`.slice(0, 200),
        description: row.description,
        clientId: row.clientId,
        managerId: managerId || null,
        status: 'PLANNING',
      },
      select: { id: true },
    });
    const changed = await tx.projectInquiry.updateMany({
      where: { id, status: 'APPROVED', projectId: null },
      data: { status: 'CONVERTED', projectId: project.id },
    });
    if (changed.count !== 1) throw new AppError('CONFLICT', 409, 'Request was already converted');
    return { projectId: project.id, created: true, userId: row.userId, managerId };
  });
  if (result.created) {
    await writeAudit({
      actorId,
      action: 'project-inquiry.convert',
      subjectType: 'ProjectInquiry',
      subjectId: id,
    });
    await Promise.allSettled([
      notifyUsersWithPermission(
        PERMISSIONS.PROJECTS_READ,
        'New client project',
        `Project ${result.projectId} was created from an approved client request.`,
      ),
      ...(result.userId
        ? [
            emitNotification({
              eventKey: 'project.inquiry',
              userId: result.userId,
              title: 'Project created',
              body: 'Your approved request is now a project in the Client Portal.',
              dedupeKey: `project-inquiry:${id}:converted`,
              requiredEmail: true,
            }),
          ]
        : []),
      ...(result.managerId
        ? [
            emitNotification({
              eventKey: 'project.assignment',
              userId: result.managerId,
              title: 'Project assigned',
              body: `You have been assigned to project ${result.projectId}.`,
              dedupeKey: `project-inquiry:${id}:manager:${result.managerId}`,
            }),
          ]
        : []),
    ]);
  }
  return { projectId: result.projectId, created: result.created };
}
