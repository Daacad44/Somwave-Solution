import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    clientDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/storage', () => ({
  decodeUpload: vi.fn(() => Buffer.from('%PDF')),
  putObject: vi.fn(async () => 'obj/test'),
  getObject: vi.fn(() => Buffer.from('%PDF')),
}));

import { prisma } from '../lib/prisma';
import { getDocumentFile, listDocuments } from './document.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listDocuments', () => {
  it('scopes to a client when clientId is provided', async () => {
    vi.mocked(prisma.clientDocument.findMany).mockResolvedValue([] as never);
    await listDocuments('cl_1');
    expect(prisma.clientDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, clientId: 'cl_1' } }),
    );
  });
});

describe('getDocumentFile', () => {
  it('returns 404 for another client', async () => {
    vi.mocked(prisma.clientDocument.findFirst).mockResolvedValue(null as never);
    await expect(getDocumentFile('doc_1', 'cl_other')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.clientDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc_1', deletedAt: null, clientId: 'cl_other' },
      }),
    );
  });
});
