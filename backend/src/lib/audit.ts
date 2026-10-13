import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { correlationId } from './requestContext';

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  subjectType: string;
  subjectId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  correlationId?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      correlationId: input.correlationId ?? correlationId(),
      ...(input.before !== undefined ? { before: input.before ?? Prisma.JsonNull } : {}),
      ...(input.after !== undefined ? { after: input.after ?? Prisma.JsonNull } : {}),
    },
  });
}
