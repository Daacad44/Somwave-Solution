import { Prisma } from '@prisma/client';
import { defaultSiteContent, siteContentSchema, type SiteContent } from '@somwave/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';

const identity = { group: 'website', key: 'content' } as const;
const draftIdentity = { group: 'website', key: 'content-draft' } as const;
type DraftStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED';
export interface SiteContentDraft {
  content: SiteContent;
  status: DraftStatus;
  authorId: string;
  reviewerId: string | null;
}

function parseDraft(value: unknown): SiteContentDraft {
  if (!value || typeof value !== 'object')
    throw new AppError('CONFLICT', 409, 'Website draft is invalid');
  const raw = value as Record<string, unknown>;
  const parsed = siteContentSchema.safeParse(raw.content);
  if (
    !parsed.success ||
    !['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(String(raw.status)) ||
    typeof raw.authorId !== 'string' ||
    !(raw.reviewerId === null || typeof raw.reviewerId === 'string')
  ) {
    throw new AppError('CONFLICT', 409, 'Website draft is invalid');
  }
  return {
    content: parsed.data,
    status: raw.status as DraftStatus,
    authorId: raw.authorId,
    reviewerId: raw.reviewerId,
  };
}

export async function readSiteContent(): Promise<SiteContent> {
  const row = await prisma.setting.findUnique({ where: { group_key: identity } });
  if (!row?.isPublic) return defaultSiteContent;
  const parsed = siteContentSchema.safeParse(row.value);
  return parsed.success ? parsed.data : defaultSiteContent;
}

export async function readSiteContentDraft(): Promise<SiteContentDraft | null> {
  const row = await prisma.setting.findUnique({ where: { group_key: draftIdentity } });
  return row ? parseDraft(row.value) : null;
}

/** Editors save privately. Public readers continue to receive the last published version. */
export async function updateSiteContent(
  input: SiteContent,
  actorId: string,
): Promise<SiteContentDraft> {
  const content = siteContentSchema.parse(input);
  const draft: SiteContentDraft = { content, status: 'DRAFT', authorId: actorId, reviewerId: null };
  await prisma.setting.upsert({
    where: { group_key: draftIdentity },
    create: { ...draftIdentity, value: draft as unknown as Prisma.InputJsonValue, isPublic: false },
    update: { value: draft as unknown as Prisma.InputJsonValue, isPublic: false },
  });
  return draft;
}

async function advanceDraft(
  expected: DraftStatus,
  next: DraftStatus,
  actorId: string,
): Promise<SiteContentDraft> {
  const row = await prisma.setting.findUnique({ where: { group_key: draftIdentity } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Website draft not found');
  const draft = parseDraft(row.value);
  if (draft.status !== expected)
    throw new AppError('CONFLICT', 409, `Website draft must be ${expected.toLowerCase()}`);
  if (next === 'APPROVED' && draft.authorId === actorId) {
    throw new AppError('FORBIDDEN', 403, 'A different administrator must approve this draft');
  }
  const advanced = { ...draft, status: next, reviewerId: next === 'APPROVED' ? actorId : null };
  const result = await prisma.setting.updateMany({
    where: { id: row.id, updatedAt: row.updatedAt },
    data: { value: advanced as Prisma.InputJsonValue },
  });
  if (result.count !== 1)
    throw new AppError('CONFLICT', 409, 'Website draft changed; reload and try again');
  return advanced;
}

export function submitSiteContentDraft(actorId: string): Promise<SiteContentDraft> {
  return advanceDraft('DRAFT', 'IN_REVIEW', actorId);
}

export function approveSiteContentDraft(actorId: string): Promise<SiteContentDraft> {
  return advanceDraft('IN_REVIEW', 'APPROVED', actorId);
}

export async function publishSiteContentDraft(actorId: string): Promise<SiteContent> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.setting.findUnique({ where: { group_key: draftIdentity } });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Website draft not found');
    const draft = parseDraft(row.value);
    if (draft.status !== 'APPROVED' || !draft.reviewerId) {
      throw new AppError(
        'CONFLICT',
        409,
        'Website draft requires independent approval before publishing',
      );
    }
    // Claim the exact reviewed revision before replacing the public setting.
    const claimed = await tx.setting.deleteMany({
      where: { id: row.id, updatedAt: row.updatedAt },
    });
    if (claimed.count !== 1)
      throw new AppError('CONFLICT', 409, 'Website draft changed; reload and try again');
    const published = await tx.setting.upsert({
      where: { group_key: identity },
      create: { ...identity, value: draft.content as Prisma.InputJsonValue, isPublic: true },
      update: { value: draft.content as Prisma.InputJsonValue, isPublic: true },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'website.siteContent.publish',
        subjectType: 'Setting',
        subjectId: published.id,
        after: { reviewerId: draft.reviewerId, authorId: draft.authorId } as Prisma.InputJsonValue,
      },
    });
    return draft.content;
  });
}
