import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSiteContent } from '@somwave/shared';

vi.mock('../lib/prisma', () => ({
  prisma: { setting: { findUnique: vi.fn(), upsert: vi.fn() } },
}));

import { prisma } from '../lib/prisma';
import { readSiteContent, updateSiteContent } from './site-content.service';

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
  });

  it('saves a validated public setting that can hide the logo section', async () => {
    const content = {
      ...defaultSiteContent,
      trusted: { ...defaultSiteContent.trusted, approved: false },
    };
    vi.mocked(prisma.setting.upsert).mockResolvedValue({} as never);
    await expect(updateSiteContent(content)).resolves.toEqual(content);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { group_key: { group: 'website', key: 'content' } },
        update: expect.objectContaining({ isPublic: true, value: content }),
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
    await expect(updateSiteContent(content)).resolves.toEqual(content);
    expect(prisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ value: content }) }),
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
    await expect(updateSiteContent(content)).rejects.toThrow();
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });
});
