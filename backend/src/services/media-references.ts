import { prisma } from '../lib/prisma';

/** Public CMS objects can be reused across modules. Never delete a referenced asset. */
export async function mediaIsReferenced(id: string): Promise<boolean> {
  const [posts, portfolio, testimonials, team, settings] = await Promise.all([
    prisma.post.count({ where: { coverImage: { contains: id } } }),
    prisma.portfolioItem.findMany({
      where: { OR: [{ coverImage: { contains: id } }, { galleryImages: { isEmpty: false } }] },
      select: { coverImage: true, galleryImages: true },
    }),
    prisma.testimonial.count({ where: { avatarUrl: { contains: id } } }),
    prisma.teamMember.count({ where: { photoUrl: { contains: id } } }),
    prisma.setting.findMany({ where: { group: 'website' }, select: { value: true } }),
  ]);
  return (
    posts > 0 ||
    testimonials > 0 ||
    team > 0 ||
    portfolio.some(
      (row) => row.coverImage?.includes(id) || row.galleryImages.some((url) => url.includes(id)),
    ) ||
    settings.some((row) => JSON.stringify(row.value).includes(id))
  );
}
