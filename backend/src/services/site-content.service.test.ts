import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSiteContent } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: {
    setting: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma';
import {
  readSiteContent,
  readSiteContentDraft,
  updateSiteContent,
  submitSiteContentDraft,
  approveSiteContentDraft,
  publishSiteContentDraft,
  type SiteContentDraft,
} from './site-content.service';

beforeEach(() => vi.clearAllMocks());

describe('website content settings', () => {
  it('uses verified defaults when no public setting exists', async () => {
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(null);
    await expect(readSiteContent()).resolves.toEqual(defaultSiteContent);
  });

  it('does not reveal a setting marked private', async () => {
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({
      isPublic: false,
      value: { contact: { email: 'private@example.com' } },
    } as never);
    await expect(readSiteContent()).resolves.toEqual(defaultSiteContent);
  });

  it('extends existing homepage settings with slider and ecosystem defaults', async () => {
    const legacy = structuredClone(defaultSiteContent) as Record<string, unknown>;
    delete legacy.heroSlides;
    delete legacy.heroSlideOrder;
    delete legacy.ecosystem;
    delete legacy.sectionOrder;
    delete legacy.hiddenSections;
    const hero = legacy.hero as Record<string, unknown>;
    hero.headline = 'A previously edited headline';
    for (const key of [
      'imageAlt',
      'primaryLabel',
      'primaryHref',
      'secondaryLabel',
      'secondaryHref',
    ])
      delete hero[key];
    delete (legacy.trusted as Record<string, unknown>).assetUrls;
    vi.mocked(prisma.setting.findUnique).mockResolvedValue({
      isPublic: true,
      value: legacy,
    } as never);

    const content = await readSiteContent();
    expect(content.hero.headline).toBe('A previously edited headline');
    expect(content.heroSlides).toHaveLength(2);
    expect(content.heroSlideOrder).toEqual(['intro', 'software', 'connected']);
    expect(content.ecosystem.left).toHaveLength(4);
    expect(content.trusted.assetUrls).toEqual({});
    expect(content.sectionOrder).toEqual(defaultSiteContent.sectionOrder);
    expect(content.hiddenSections).toEqual([]);
  });

  it('saves a validated private draft without changing public content', async () => {
    const content = {
      ...defaultSiteContent,
      trusted: { ...defaultSiteContent.trusted, approved: false },
    };
    vi.mocked(prisma.setting.upsert).mockResolvedValue({} as never);
    await expect(updateSiteContent(content, 'editor-1')).resolves.toMatchObject({
      content,
      status: 'DRAFT',
      authorId: 'editor-1',
    });
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { group_key: { group: 'website', key: 'content-draft' } },
        update: expect.objectContaining({
          isPublic: false,
          value: expect.objectContaining({ content }),
        }),
      }),
    );
  });

  it('saves customized slide order, service destinations and logo assets', async () => {
    const content = {
      ...defaultSiteContent,
      heroSlideOrder: [
        'connected',
        'intro',
        'software',
      ] as typeof defaultSiteContent.heroSlideOrder,
      ecosystem: {
        ...defaultSiteContent.ecosystem,
        right: defaultSiteContent.ecosystem.right.map((item, index) =>
          index === 0 ? { ...item, href: '/nala-soo-xiriir?service=payments' } : item,
        ),
      },
      trusted: {
        ...defaultSiteContent.trusted,
        visibleIds: [...defaultSiteContent.trusted.visibleIds].reverse(),
        assetUrls: { hormuud: '/brand/hormuud.png' },
      },
    };
    vi.mocked(prisma.setting.upsert).mockResolvedValue({} as never);
    await expect(updateSiteContent(content, 'editor-1')).resolves.toMatchObject({ content });
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ value: expect.objectContaining({ content }) }),
      }),
    );
  });

  it('keeps section order and visibility in the private draft', async () => {
    const content = {
      ...defaultSiteContent,
      sectionOrder: [...defaultSiteContent.sectionOrder].reverse(),
      hiddenSections: ['articles', 'faq'] as typeof defaultSiteContent.hiddenSections,
    };
    vi.mocked(prisma.setting.upsert).mockResolvedValue({} as never);
    await expect(updateSiteContent(content, 'editor-1')).resolves.toMatchObject({ content });
  });

  it('requires independent review and publishes only the approved revision', async () => {
    const row: { id: string; updatedAt: Date; value: SiteContentDraft } = {
      id: 'draft-1',
      updatedAt: new Date(),
      value: {
        content: defaultSiteContent,
        status: 'DRAFT',
        authorId: 'editor-1',
        reviewerId: null,
      },
    };
    vi.mocked(prisma.setting.findUnique).mockResolvedValue(row as never);
    vi.mocked(prisma.setting.updateMany).mockResolvedValue({ count: 1 } as never);
    const tx = {
      setting: {
        findUnique: vi.fn().mockResolvedValue(row),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn().mockResolvedValue({ id: 'published-1' }),
      },
      auditLog: { create: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation((async (
      callback: (value: typeof tx) => Promise<unknown>,
    ) => callback(tx)) as never);
    await expect(readSiteContentDraft()).resolves.toMatchObject({ status: 'DRAFT' });
    await expect(submitSiteContentDraft('editor-1')).resolves.toMatchObject({
      status: 'IN_REVIEW',
    });
    row.value.status = 'IN_REVIEW';
    await expect(approveSiteContentDraft('editor-1')).rejects.toMatchObject({ status: 403 });
    await expect(approveSiteContentDraft('admin-2')).resolves.toMatchObject({
      status: 'APPROVED',
      reviewerId: 'admin-2',
    });
    await expect(publishSiteContentDraft('admin-2')).rejects.toMatchObject({ status: 409 });
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
    row.value = { ...row.value, status: 'APPROVED', reviewerId: 'admin-2' };
    await expect(publishSiteContentDraft('admin-2')).resolves.toEqual(defaultSiteContent);
    expect(tx.setting.deleteMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', updatedAt: row.updatedAt },
    });
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { group_key: { group: 'website', key: 'content' } },
        update: expect.objectContaining({ isPublic: true }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-2',
          action: 'website.siteContent.publish',
          subjectId: 'published-1',
        }),
      }),
    );
  });

  it('rejects unapproved social URL schemes', async () => {
    const content = {
      ...defaultSiteContent,
      contact: {
        ...defaultSiteContent.contact,
        social: [{ label: 'Facebook' as const, url: 'http://example.com' }],
      },
    };
    await expect(updateSiteContent(content, 'editor-1')).rejects.toThrow();
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });
});
