import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    projectInquiry: { findUnique: vi.fn(), updateMany: vi.fn() },
    projectInquiryAttachment: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock('../lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/storage')>();
  return {
    decodeUpload: actual.decodeUpload,
    putObject: vi.fn(async () => 'obj/test-object'),
    deleteObject: vi.fn(async () => {}),
    readObject: vi.fn(async () => Buffer.from('%PDF-file')),
  };
});
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));

import { prisma } from '../lib/prisma';
import { putObject, deleteObject, readObject } from '../lib/storage';
import {
  uploadProjectInquiryAttachment,
  listProjectInquiryAttachments,
  readProjectInquiryAttachment,
} from './project-inquiry-attachment.service';

const token = 'long-verified-proof-token-with-high-entropy';
const tokenHash = createHash('sha256').update(token).digest('hex');
const now = new Date();
const inquiry = {
  id: 'inq-1',
  emailVerifiedAt: now,
  status: 'EMAIL_VERIFIED' as const,
  activationTokenHash: tokenHash,
  activationExpiresAt: new Date(Date.now() + 60_000),
  clientId: null,
  attachmentCount: 0,
};
const input = {
  fileName: '../../proposal.exe',
  mimeType: 'application/pdf' as const,
  contentBase64: Buffer.from('%PDF-1.4 valid').toString('base64'),
};
const attachment = {
  id: 'att-1',
  inquiryId: inquiry.id,
  storageKey: 'obj/test-object',
  contentHash: createHash('sha256').update(Buffer.from('%PDF-1.4 valid')).digest('hex'),
  fileName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 14,
  createdAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.projectInquiryAttachment.findFirst).mockReset();
  vi.mocked(prisma.projectInquiryAttachment.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue(inquiry as never);
  vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.projectInquiryAttachment.create).mockResolvedValue(attachment as never);
});

describe('project inquiry attachments', () => {
  it('requires a verified short-lived proof before public upload', async () => {
    await expect(
      uploadProjectInquiryAttachment(inquiry.id, input, {
        kind: 'proof',
        activationToken: 'wrong',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.projectInquiry.updateMany).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it('accepts a verified PDF, reserves one of three slots, and sanitizes the filename', async () => {
    const result = await uploadProjectInquiryAttachment(inquiry.id, input, {
      kind: 'proof',
      activationToken: token,
    });
    expect(result).toEqual({
      id: 'att-1',
      fileName: 'proposal.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 14,
      createdAt: now.toISOString(),
    });
    expect(prisma.projectInquiry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: inquiry.id,
          attachmentCount: { lt: 3 },
          activationTokenHash: tokenHash,
        }),
        data: { attachmentCount: { increment: 1 } },
      }),
    );
    expect(prisma.projectInquiryAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inquiryId: inquiry.id, fileName: 'proposal.pdf' }),
      }),
    );
  });

  it('rejects claimed PDF content with the wrong magic bytes before storage', async () => {
    await expect(
      uploadProjectInquiryAttachment(
        inquiry.id,
        { ...input, contentBase64: Buffer.from('<script>x</script>').toString('base64') },
        { kind: 'proof', activationToken: token },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.projectInquiry.updateMany).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it('rejects files above 5 MiB before reserving a slot', async () => {
    const tooLarge = Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(5 * 1024 * 1024)]);
    await expect(
      uploadProjectInquiryAttachment(
        inquiry.id,
        { ...input, contentBase64: tooLarge.toString('base64') },
        { kind: 'proof', activationToken: token },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(prisma.projectInquiry.updateMany).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it('enforces the atomic three-file limit before writing storage', async () => {
    vi.mocked(prisma.projectInquiry.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(
      uploadProjectInquiryAttachment(inquiry.id, input, { kind: 'proof', activationToken: token }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(putObject).not.toHaveBeenCalled();
  });

  it('returns the existing attachment for a retry with identical file bytes', async () => {
    vi.mocked(prisma.projectInquiryAttachment.findFirst).mockResolvedValue(attachment as never);
    const result = await uploadProjectInquiryAttachment(inquiry.id, input, {
      kind: 'proof',
      activationToken: token,
    });
    expect(result.id).toBe('att-1');
    expect(prisma.projectInquiry.updateMany).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it('releases the reserved slot and object when metadata creation fails', async () => {
    vi.mocked(prisma.projectInquiryAttachment.create).mockRejectedValueOnce(
      new Error('db unavailable'),
    );
    await expect(
      uploadProjectInquiryAttachment(inquiry.id, input, { kind: 'proof', activationToken: token }),
    ).rejects.toThrow('db unavailable');
    expect(deleteObject).toHaveBeenCalledWith('obj/test-object');
    expect(prisma.projectInquiry.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { attachmentCount: { decrement: 1 } },
      }),
    );
  });

  it('denies another client before listing or downloading file bytes', async () => {
    vi.mocked(prisma.projectInquiry.findUnique).mockResolvedValue({
      ...inquiry,
      status: 'ACCOUNT_CREATED',
      clientId: 'client-1',
    } as never);
    await expect(
      listProjectInquiryAttachments(inquiry.id, { kind: 'client', clientId: 'client-2' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      readProjectInquiryAttachment(inquiry.id, attachment.id, {
        kind: 'client',
        clientId: 'client-2',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.projectInquiryAttachment.findMany).not.toHaveBeenCalled();
    expect(readObject).not.toHaveBeenCalled();
  });

  it('scopes downloads by both inquiry and attachment ID', async () => {
    vi.mocked(prisma.projectInquiryAttachment.findFirst).mockResolvedValue(attachment as never);
    const file = await readProjectInquiryAttachment(inquiry.id, attachment.id, { kind: 'admin' });
    expect(file.mimeType).toBe('application/pdf');
    expect(prisma.projectInquiryAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: attachment.id, inquiryId: inquiry.id },
    });
  });
});
