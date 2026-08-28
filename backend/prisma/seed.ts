// Idempotent seed (SYSTEM_PROMPT §7): the fixed roles, the permission vocabulary,
// SUPER_ADMIN granted every permission, and (when SEED_ADMIN_PASSWORD is set) a
// super-admin user. Run with `npm run db:seed`.
import { PrismaClient } from '@prisma/client';
import { ROLES, PERMISSIONS } from '@somwave/shared';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Permissions.
  for (const key of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const permissions = await prisma.permission.findMany();

  // Roles.
  for (const name of Object.values(ROLES)) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
  }

  // SUPER_ADMIN holds every permission.
  await prisma.role.update({
    where: { name: ROLES.SUPER_ADMIN },
    data: { permissions: { set: permissions.map((permission) => ({ id: permission.id })) } },
  });

  // Website services shown on the public site (managed from the CMS later).
  const services = [
    {
      slug: 'horumarinta-websaydka',
      title: 'Horumarinta Websaydka',
      summary:
        'Website-yo dhaqso ah oo naqshadeysan, ku habboon mobil iyo kombuyuutar, oo Google si fiican u arko.',
      order: 1,
    },
    {
      slug: 'nidaamyo-gudaha',
      title: 'Nidaamyo Gudaha ah',
      summary:
        'Nidaamyo maamul oo mashruuc, shaqaale, iyo maaliyad hal meel isugu keena — Excel iyo WhatsApp ka bax.',
      order: 2,
    },
    {
      slug: 'barnaamijyo-mobil',
      title: 'Barnaamijyo Mobil',
      summary:
        'Apps iOS iyo Android ah oo isku xiran API-gaaga, adeeggaaga macaamiisha kuu fududeeya.',
      order: 3,
    },
  ];
  for (const service of services) {
    await prisma.service.upsert({ where: { slug: service.slug }, update: {}, create: service });
  }

  // Portfolio items shown on the public site (managed from the CMS later).
  const portfolio = [
    {
      slug: 'nidaamka-maamulka-iskuulka',
      title: 'Nidaamka Maamulka Iskuulka',
      summary: 'Nidaam buuxa oo maamula ardayda, lacag-bixinta, iyo natiijooyinka.',
      description:
        'Waxaan u dhisnay iskuul weyn nidaam maamul oo casri ah — diiwaangelinta ardayda, lacag-bixinta, iyo warbixinnada — oo dhammaan hal meel ka shaqeeya.',
      client: 'Iskuul Gaar ah',
      order: 1,
    },
    {
      slug: 'app-dhaqaale-mobil',
      title: 'App Dhaqaale Mobil',
      summary: 'Barnaamij mobil oo macaamiisha u sahla lacag-bixin iyo la-socod.',
      description:
        'App iOS iyo Android ah oo isku xiran API ammaan ah, macaamiishu ku bixin karaan biilasha oo ay la socon karaan mashruucyadooda.',
      client: 'Shirkad Dhaqaale',
      order: 2,
    },
  ];
  for (const item of portfolio) {
    await prisma.portfolioItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: { ...item, publishedAt: new Date() },
    });
  }

  // Blog category + posts.
  const category = await prisma.category.upsert({
    where: { slug: 'talooyin' },
    update: {},
    create: { slug: 'talooyin', name: 'Talooyin' },
  });
  const posts = [
    {
      slug: 'sida-loo-doorto-shirkad-website',
      title: 'Sida loo doorto shirkad website oo ku habboon',
      excerpt: 'Afar shay oo aad fiirsato kahor intaadan dooran shirkad kuu dhista website.',
      body: 'Marka aad doorato shirkad website, fiiri khibradda, tayada naqshadda, taageerada kadib, iyo qiimaha cad. Shirkad wanaagsan waxay ku caawisaa inaad online si guul leh ugu koraan.',
    },
    {
      slug: 'muhiimadda-nidaamyada-gudaha',
      title: 'Muhiimadda nidaamyada gudaha ee ganacsiga',
      excerpt: 'Sababta ganacsigaagu uga baxo Excel iyo WhatsApp una gudbo nidaam buuxa.',
      body: 'Nidaamyada gudaha waxay hal meel isugu keenaan mashruucyada, shaqaalaha, iyo maaliyadda — taasoo yareysa khaladaadka oo kordhisa hufnaanta.',
    },
  ];
  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {},
      create: { ...post, isPublished: true, publishedAt: new Date(), categoryId: category.id },
    });
  }

  // Super-admin user — only when a password is provided; never a hardcoded one.
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@somwave.com';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.warn('[seed] SEED_ADMIN_PASSWORD not set — skipped super-admin user creation.');
    return;
  }

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: ROLES.SUPER_ADMIN } });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Super Admin', passwordHash: await hashPassword(password) },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
    update: {},
    create: { userId: user.id, roleId: superAdmin.id },
  });
  console.log(`[seed] Super-admin ready: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
