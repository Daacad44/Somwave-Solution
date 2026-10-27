import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('./prisma', () => ({ prisma: { auditLog: { create: vi.fn() } } }));
vi.mock('./requestContext', () => ({
  correlationId: () => 'corr_1',
  requestIp: () => '203.0.113.7',
}));

import { prisma } from './prisma';
import { recordAudit, writeAudit } from './audit';

describe('audit helpers', () => {
  it('records inside the given transaction with request context', async () => {
    const create = vi.fn();
    await recordAudit({ auditLog: { create } } as never, {
      actorId: 'usr_1',
      action: 'invoice.issue',
      subjectType: 'Invoice',
      subjectId: 'inv_1',
      before: { status: 'DRAFT' },
      after: { status: 'SENT' },
      metadata: { source: 'MANUAL' },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'usr_1',
        action: 'invoice.issue',
        subjectType: 'Invoice',
        subjectId: 'inv_1',
        correlationId: 'corr_1',
        ip: '203.0.113.7',
        before: { status: 'DRAFT' },
        after: { status: 'SENT' },
        metadata: { source: 'MANUAL' },
      },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('omits unset JSON columns and stores explicit null as JSON null', async () => {
    await writeAudit({ action: 'x', subjectType: 'Y', before: null });
    const data = vi.mocked(prisma.auditLog.create).mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ before: Prisma.JsonNull, after: undefined, metadata: undefined });
  });
});
