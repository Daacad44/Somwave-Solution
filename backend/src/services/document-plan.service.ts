import type { CreateDocumentPlanInput, DocumentPlan } from '@somwave/shared';
import { documentPlanSchema } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { assertProjectAccess } from './project-documentation.service';

type Actor = Express.AuthUserContext;

async function source(projectId: string, documentId: string) {
  const document = await prisma.projectDocumentation.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      format: true,
      content: true,
      currentVersion: true,
    },
  });
  if (!document) throw new AppError('NOT_FOUND', 404, 'Project documentation not found');
  return document;
}

function proposalNotFound(): never {
  throw new AppError('NOT_FOUND', 404, 'Document plan not found');
}

/** An editable starting point; reviewers can also submit a fully curated plan. */
export function suggestDocumentPlan(
  content: string,
  format: 'MARKDOWN' | 'RICH_TEXT',
): DocumentPlan {
  const text =
    format === 'RICH_TEXT'
      ? content
          .replace(
            /<h([1-3])[^>]*>/gi,
            (_match, level: string) => `\n${'#'.repeat(Number(level))} `,
          )
          .replace(/<li[^>]*>/gi, '\n- ')
          .replace(/<\/(?:h[1-6]|li|p)>/gi, '\n')
          .replace(/<[^>]*>/g, ' ')
      : content;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim());
  const phases: DocumentPlan['phases'] = [];
  const milestones: DocumentPlan['milestones'] = [];
  const tasks: DocumentPlan['tasks'] = [];
  let phaseKey = '';
  let milestoneKey = '';
  let epicKey = '';
  let taskKey = '';
  const addPhase = (name: string) => {
    phaseKey = `phase_${phases.length + 1}`;
    phases.push({ key: phaseKey, title: name.slice(0, 200) });
    milestoneKey = '';
    epicKey = '';
  };
  const addMilestone = (name: string) => {
    if (!phaseKey) addPhase('Implementation');
    milestoneKey = `milestone_${milestones.length + 1}`;
    milestones.push({ key: milestoneKey, phaseKey, title: name.slice(0, 200) });
    epicKey = '';
  };
  const addEpic = (name: string) => {
    if (!milestoneKey) addMilestone('Delivery');
    epicKey = `epic_${tasks.filter((item) => item.kind === 'EPIC').length + 1}`;
    tasks.push({
      key: epicKey,
      kind: 'EPIC',
      title: name.slice(0, 200),
      phaseKey,
      milestoneKey,
      type: 'FEATURE',
      priority: 'MEDIUM',
      dependencyKeys: [],
      checklist: [],
    });
    taskKey = '';
  };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      const name = heading[2]!.trim();
      if (name.length < 3) continue;
      if (heading[1]!.length === 1 && phases.length < 20) addPhase(name);
      else if (heading[1]!.length === 2 && milestones.length < 50) addMilestone(name);
      else if (heading[1]!.length === 3 && tasks.length < 200) addEpic(name);
      continue;
    }
    const bullet = /^(\s*)[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/.exec(line);
    if (!bullet || tasks.length >= 200) continue;
    const name = bullet[2]!.trim().slice(0, 200);
    if (name.length < 3) continue;
    if (!epicKey) addEpic('Planned work');
    const nested = bullet[1]!.length >= 2 && !!taskKey;
    const key = `item_${tasks.length + 1}`;
    tasks.push({
      key,
      kind: nested ? 'SUBTASK' : 'TASK',
      title: name,
      phaseKey,
      milestoneKey,
      parentKey: nested ? taskKey : epicKey,
      type: 'FEATURE',
      priority: 'MEDIUM',
      dependencyKeys: [],
      checklist: [],
    });
    if (!nested) taskKey = key;
  }
  if (!tasks.length) {
    if (!epicKey) addEpic('Planned work');
    const title =
      lines
        .find((line) => line.replace(/^#+\s*/, '').trim().length >= 5)
        ?.replace(/^#+\s*/, '')
        .trim() ?? 'Implement approved requirements';
    tasks.push({
      key: 'item_2',
      kind: 'TASK',
      title: title.slice(0, 200),
      phaseKey,
      milestoneKey,
      parentKey: epicKey,
      type: 'FEATURE',
      priority: 'MEDIUM',
      dependencyKeys: [],
      checklist: [],
    });
  }
  return documentPlanSchema.parse({ phases, milestones, tasks });
}

export async function createDocumentPlan(
  projectId: string,
  documentId: string,
  actor: Actor,
  input: CreateDocumentPlanInput,
) {
  await assertProjectAccess(projectId, actor, 'write');
  const document = await source(projectId, documentId);
  if (document.status !== 'APPROVED' || document.format === 'FILE' || !document.content)
    throw new AppError('CONFLICT', 409, 'An approved text document is required');
  const plan = input.plan ?? suggestDocumentPlan(document.content, document.format);
  const proposal = await prisma.documentPlanProposal.create({
    data: { documentId, sourceVersion: document.currentVersion, plan, proposedById: actor.id },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'documentPlan.propose',
      subjectType: 'DocumentPlanProposal',
      subjectId: proposal.id,
    },
  });
  return proposal;
}

export async function listDocumentPlans(projectId: string, documentId: string, actor: Actor) {
  await assertProjectAccess(projectId, actor, 'read');
  await source(projectId, documentId);
  return prisma.documentPlanProposal.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDocumentPlan(
  projectId: string,
  documentId: string,
  planId: string,
  actor: Actor,
) {
  await assertProjectAccess(projectId, actor, 'read');
  await source(projectId, documentId);
  return (
    (await prisma.documentPlanProposal.findFirst({ where: { id: planId, documentId } })) ??
    proposalNotFound()
  );
}

export async function reviewDocumentPlan(
  projectId: string,
  documentId: string,
  planId: string,
  actor: Actor,
  decision: 'activate' | 'reject',
  note?: string,
) {
  await assertProjectAccess(projectId, actor, 'approve');
  const document = await source(projectId, documentId);
  const proposal = await prisma.documentPlanProposal.findFirst({
    where: { id: planId, documentId },
  });
  if (!proposal) proposalNotFound();
  if (proposal.status !== 'PROPOSED')
    throw new AppError('CONFLICT', 409, 'Plan was already reviewed');
  if (
    decision === 'activate' &&
    (document.status !== 'APPROVED' || document.currentVersion !== proposal.sourceVersion)
  )
    throw new AppError('CONFLICT', 409, 'Source document changed; create a new plan');
  const plan = documentPlanSchema.parse(proposal.plan);
  return prisma.$transaction(
    async (tx) => {
      if (decision === 'activate') {
        const current = await tx.projectDocumentation.findFirst({
          where: { id: documentId, projectId, deletedAt: null },
          select: { status: true, currentVersion: true },
        });
        if (
          !current ||
          current.status !== 'APPROVED' ||
          current.currentVersion !== proposal.sourceVersion
        )
          throw new AppError('CONFLICT', 409, 'Source document changed; create a new plan');
      }
      const claimed = await tx.documentPlanProposal.updateMany({
        where: { id: planId, documentId, status: 'PROPOSED' },
        data: {
          status: decision === 'activate' ? 'ACTIVATED' : 'REJECTED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: note ?? null,
        },
      });
      if (claimed.count !== 1) throw new AppError('CONFLICT', 409, 'Plan was already reviewed');
      const phaseIds = new Map<string, string>();
      const milestoneIds = new Map<string, string>();
      const taskIds = new Map<string, string>();
      if (decision === 'activate') {
        for (const [order, phase] of plan.phases.entries()) {
          const row = await tx.projectPhase.create({
            data: {
              projectId,
              title: phase.title,
              description: phase.description ?? null,
              order,
              startDate: phase.startDate ? new Date(phase.startDate) : null,
              dueDate: phase.dueDate ? new Date(phase.dueDate) : null,
            },
          });
          phaseIds.set(phase.key, row.id);
        }
        for (const [order, milestone] of plan.milestones.entries()) {
          const row = await tx.milestone.create({
            data: {
              projectId,
              title: milestone.title,
              description: milestone.description ?? null,
              order,
              dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
              documentLinks: { create: { documentId } },
            },
          });
          milestoneIds.set(milestone.key, row.id);
        }
        for (const kind of ['EPIC', 'TASK', 'SUBTASK'] as const) {
          for (const item of plan.tasks.filter((task) => task.kind === kind)) {
            const row = await tx.task.create({
              data: {
                projectId,
                title: item.title,
                description: item.description ?? null,
                kind: item.kind,
                type: item.type,
                priority: item.priority,
                status: 'TODO',
                approvalStatus: 'APPROVED',
                reporterId: proposal.proposedById,
                reviewedById: actor.id,
                reviewedAt: new Date(),
                reviewRequired: true,
                phaseId: phaseIds.get(item.phaseKey)!,
                milestoneId: milestoneIds.get(item.milestoneKey)!,
                parentTaskId: item.parentKey ? taskIds.get(item.parentKey)! : null,
                estimatedHours: item.estimatedHours ?? null,
                acceptanceCriteria: item.acceptanceCriteria ?? null,
                startDate: item.startDate ? new Date(item.startDate) : null,
                dueDate: item.dueDate ? new Date(item.dueDate) : null,
                documentLinks: { create: { documentId } },
                ...(item.checklist.length
                  ? {
                      checklist: {
                        create: item.checklist.map((title, order) => ({ title, order })),
                      },
                    }
                  : {}),
              },
            });
            taskIds.set(item.key, row.id);
          }
        }
        for (const item of plan.tasks) {
          if (!item.dependencyKeys.length) continue;
          await tx.taskDependency.createMany({
            data: item.dependencyKeys.map((dependencyKey) => ({
              taskId: taskIds.get(item.key)!,
              dependsOnId: taskIds.get(dependencyKey)!,
            })),
          });
        }
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `documentPlan.${decision}`,
          subjectType: 'DocumentPlanProposal',
          subjectId: planId,
        },
      });
      return {
        id: planId,
        status: decision === 'activate' ? 'ACTIVATED' : 'REJECTED',
        phaseIds: Object.fromEntries(phaseIds),
        milestoneIds: Object.fromEntries(milestoneIds),
        taskIds: Object.fromEntries(taskIds),
      };
    },
    { timeout: 20_000, isolationLevel: 'Serializable' },
  );
}
