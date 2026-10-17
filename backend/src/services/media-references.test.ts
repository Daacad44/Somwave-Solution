import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({
  prisma: {
    post: { count: vi.fn() },
    portfolioItem: { findMany: vi.fn() },
    testimonial: { count: vi.fn() },
    teamMember: { count: vi.fn() },
    setting: { findMany: vi.fn() },
  },
}));
import { prisma } from '../lib/prisma';
import { mediaIsReferenced } from './media-references';
beforeEach(() => {
  vi.mocked(prisma.post.count).mockResolvedValue(0);
  vi.mocked(prisma.portfolioItem.findMany).mockResolvedValue([]);
  vi.mocked(prisma.testimonial.count).mockResolvedValue(0);
  vi.mocked(prisma.teamMember.count).mockResolvedValue(0);
  vi.mocked(prisma.setting.findMany).mockResolvedValue([]);
});
describe('global public image references', () => {
  it('protects portfolio gallery images shared with an article', async () => {
    vi.mocked(prisma.portfolioItem.findMany).mockResolvedValue([
      { coverImage: null, galleryImages: ['https://api.test/article-images/img1'] },
    ] as never);
    expect(await mediaIsReferenced('img1')).toBe(true);
  });
  it('protects unpublished website draft images', async () => {
    vi.mocked(prisma.setting.findMany).mockResolvedValue([
      { value: { content: { hero: { imageUrl: 'https://api.test/article-images/img1' } } } },
    ] as never);
    expect(await mediaIsReferenced('img1')).toBe(true);
  });
  it('permits deletion only when all supported modules are unreferenced', async () => {
    expect(await mediaIsReferenced('img1')).toBe(false);
  });
});
