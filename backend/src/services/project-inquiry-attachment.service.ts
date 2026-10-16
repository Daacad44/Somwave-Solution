import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma, type ProjectInquiryAttachment as AttachmentRow } from '@prisma/client';
import type { ProjectInquiryAttachment, ProjectInquiryAttachmentInput } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { decodeUpload, deleteObject, putObject, readObject } from '../lib/storage';
import { hashRefreshToken } from '../lib/tokens';
import { writeAudit } from '../lib/audit';
import { logger } from '../lib/logger';

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const UPLOADABLE_STATUSES = ['EMAIL_VERIFIED', 'ACCOUNT_CREATED', 'UNDER_REVIEW'] as const;
type Access =
  | { kind: 'proof'; activationToken: string }
  | { kind: 'client'; clientId: string }
  | { kind: 'admin' };

function toPublic(row: AttachmentRow): ProjectInquiryAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}

function safeFileName(fileName: string, mimeType: string): string {
  const suffix =
    mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : '.jpg';
  const source = fileName.replace(/\\/g, '/').split('/').pop() ?? 'attachment';
  const stem = source
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9 _.-]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 90);
  return `${stem || 'attachment'}${suffix}`;
}

function validProof(expectedHash: string | null, expiresAt: Date | null, token: string): boolean {
  if (!expectedHash || !expiresAt || expiresAt <= new Date()) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hashRefreshToken(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function assertAccess(id: string, access: Access, upload = false) {
  const row = await prisma.projectInquiry.findUnique({ where: { id } });
  if (!row || !row.emailVerifiedAt)
    throw new AppError('NOT_FOUND', 404, 'Project request not found');
  if (access.kind === 'proof') {
    if (
      !validProof(row.activationTokenHash, row.activationExpiresAt, access.activationToken) ||
      row.status !== 'EMAIL_VERIFIED'
    ) {
      throw new AppError('FORBIDDEN', 403, 'Verification proof is invalid or expired');
    }
  } else if (access.kind === 'client') {
    if (row.clientId !== access.clientId)
      throw new AppError('NOT_FOUND', 404, 'Project request not found');
  }
  if (upload && !UPLOADABLE_STATUSES.includes(row.status as (typeof UPLOADABLE_STATUSES)[number])) {
    throw new AppError('CONFLICT', 409, 'Attachments are closed for this request');
  }
  return row;
}

export async function uploadProjectInquiryAttachment(
  id: string,
  input: ProjectInquiryAttachmentInput,
  access: Exclude<Access, { kind: 'admin' }>,
  actorId: string | null = null,
): Promise<ProjectInquiryAttachment> {
  await assertAccess(id, access, true);
  const bytes = decodeUpload(input.contentBase64, input.mimeType);
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new AppError('VALIDATION_ERROR', 400, 'Each attachment must be 5 MB or smaller');
  }
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const duplicate = await prisma.projectInquiryAttachment.findFirst({
    where: { inquiryId: id, contentHash },
  });
  if (duplicate) return toPublic(duplicate);
  const now = new Date();
  const where: Prisma.ProjectInquiryWhereInput = {
    id,
    attachmentCount: { lt: MAX_ATTACHMENTS },
    ...(access.kind === 'proof'
      ? {
          status: 'EMAIL_VERIFIED',
          activationTokenHash: hashRefreshToken(access.activationToken),
          activationExpiresAt: { gt: now },
        }
      : { clientId: access.clientId, status: { in: [...UPLOADABLE_STATUSES] } }),
  };
  const reserved = await prisma.projectInquiry.updateMany({
    where,
    data: { attachmentCount: { increment: 1 } },
  });
  if (reserved.count !== 1) {
    throw new AppError('CONFLICT', 409, 'Attachment limit reached or request changed');
  }

  let storageKey: string | null = null;
  let committed = false;
  try {
    storageKey = await putObject(bytes, input.mimeType);
    const row = await prisma.projectInquiryAttachment.create({
      data: {
        inquiryId: id,
        storageKey,
        contentHash,
        fileName: safeFileName(input.fileName, input.mimeType),
        mimeType: input.mimeType,
        sizeBytes: bytes.length,
      },
    });
    committed = true;
    try {
      await writeAudit({
        actorId,
        action: 'project-inquiry.attachment.add',
        subjectType: 'ProjectInquiryAttachment',
        subjectId: row.id,
      });
    } catch (error) {
      logger.warn(
        { attachmentId: row.id, errorName: error instanceof Error ? error.name : 'unknown' },
        'Project inquiry attachment audit could not be written',
      );
    }
    return toPublic(row);
  } catch (error) {
    if (!committed) {
      if (storageKey) {
        try {
          await deleteObject(storageKey);
        } catch (cleanupError) {
          logger.warn(
            {
              inquiryId: id,
              errorName: cleanupError instanceof Error ? cleanupError.name : 'unknown',
            },
            'Project inquiry attachment object cleanup failed',
          );
        }
      }
      await prisma.projectInquiry.updateMany({
        where: { id, attachmentCount: { gt: 0 } },
        data: { attachmentCount: { decrement: 1 } },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.projectInquiryAttachment.findFirst({
        where: { inquiryId: id, contentHash },
      });
      if (existing) return toPublic(existing);
    }
    throw error;
  }
}

export async function listProjectInquiryAttachments(
  id: string,
  access: Exclude<Access, { kind: 'proof' }>,
): Promise<ProjectInquiryAttachment[]> {
  await assertAccess(id, access);
  const rows = await prisma.projectInquiryAttachment.findMany({
    where: { inquiryId: id },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toPublic);
}

export async function readProjectInquiryAttachment(
  id: string,
  attachmentId: string,
  access: Exclude<Access, { kind: 'proof' }>,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  await assertAccess(id, access);
  const row = await prisma.projectInquiryAttachment.findFirst({
    where: { id: attachmentId, inquiryId: id },
  });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Attachment not found');
  const bytes = await readObject(row.storageKey);
  if (!bytes) throw new AppError('NOT_FOUND', 404, 'Attachment not found');
  return { bytes, mimeType: row.mimeType, fileName: row.fileName };
}
