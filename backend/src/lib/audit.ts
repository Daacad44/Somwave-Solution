import { prisma } from './prisma';

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  subjectType: string;
  subjectId?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
    },
  });
}
