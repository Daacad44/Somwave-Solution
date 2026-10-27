import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { correlationId, requestIp } from './requestContext';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  subjectType: string;
  subjectId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  correlationId?: string | null;
  ip?: string | null;
}

type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

function auditData(input: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  const json = (value: Prisma.InputJsonValue | null | undefined) =>
    value === undefined ? undefined : (value ?? Prisma.JsonNull);
  return {
    actorId: input.actorId ?? null,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    correlationId: input.correlationId ?? correlationId(),
    ip: input.ip ?? requestIp(),
    before: json(input.before),
    after: json(input.after),
    metadata: json(input.metadata),
  };
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({ data: auditData(input) });
}

/**
 * Writes the audit row inside the caller's transaction, so the change and its
 * audit record commit or roll back together. Every I8 finance mutation uses this.
 */
export async function recordAudit(tx: AuditWriter, input: AuditInput): Promise<void> {
  await tx.auditLog.create({ data: auditData(input) });
}
