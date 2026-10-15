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

  it('saves a validated public setting that can hide the logo section', async () => {
    const content = {
      ...defaultSiteContent,
      trusted: { approved: false, visibleIds: defaultSiteContent.trusted.visibleIds },
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
