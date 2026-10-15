import { Prisma } from '@prisma/client';
import { defaultSiteContent, siteContentSchema, type SiteContent } from '@somwave/shared';
import { prisma } from '../lib/prisma';

const identity = { group: 'website', key: 'content' } as const;

export async function readSiteContent(): Promise<SiteContent> {
  const row = await prisma.setting.findUnique({ where: { group_key: identity } });
  if (!row?.isPublic) return defaultSiteContent;
  const parsed = siteContentSchema.safeParse(row.value);
  return parsed.success ? parsed.data : defaultSiteContent;
}

export async function updateSiteContent(input: SiteContent): Promise<SiteContent> {
  const content = siteContentSchema.parse(input);
  await prisma.setting.upsert({
    where: { group_key: identity },
    create: { ...identity, value: content as Prisma.InputJsonValue, isPublic: true },
    update: { value: content as Prisma.InputJsonValue, isPublic: true },
  });
  return content;
}
