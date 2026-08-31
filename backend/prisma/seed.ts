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

  // EDITOR manages website content via the CMS (W4, §9): content.* only.
  const contentPermissions = permissions.filter((p) => p.key.startsWith('content.'));
  await prisma.role.update({
    where: { name: ROLES.EDITOR },
    data: { permissions: { set: contentPermissions.map((permission) => ({ id: permission.id })) } },
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

  // Careers — open positions.
  const openings = [
    {
      slug: 'horumariye-frontend',
      title: 'Horumariye Frontend',
      location: 'Muqdisho / Fog',
      employmentType: 'FULL_TIME' as const,
      summary: 'Ku biir kooxdayada oo dhis interfaces casri ah oo React ah.',
      description:
        'Waxaan raadinaynaa horumariye frontend oo khibrad u leh React iyo TypeScript, kaasoo naga caawiya dhisidda portal-ka iyo nidaamyada gudaha. Waa inaad si fiican u fahamtaa naqshadaynta iyo isticmaalka.',
    },
    {
      slug: 'naqshadeeye-uiux',
      title: 'Naqshadeeye UI/UX',
      location: 'Muqdisho',
      employmentType: 'CONTRACT' as const,
      summary: 'Naqshadee waxyaabo dad badan isticmaali karaan oo qurux badan.',
      description:
        'Naqshadeeye UI/UX oo naga caawiya inaan sameyno waxyaabo fudud oo la isticmaalo. Khibrad Figma iyo fikirka isticmaalaha ayaa lama huraan ah.',
    },
  ];
  for (const opening of openings) {
    await prisma.jobOpening.upsert({
      where: { slug: opening.slug },
      update: {},
      create: { ...opening, publishedAt: new Date() },
    });
  }

  // Sample projects (I2.1) — seeded once, only when none exist yet (no natural
  // unique key to upsert on).
  if ((await prisma.project.count()) === 0) {
    await prisma.project.createMany({
      data: [
        {
          name: 'Nidaamka Maamulka Iskuulka',
          description: 'Dhisidda nidaamka buuxa ee maamulka ardayda iyo lacag-bixinta.',
          status: 'ACTIVE',
          startDate: new Date('2026-01-15'),
          dueDate: new Date('2026-06-30'),
          budget: '25000.00',
        },
        {
          name: 'App Dhaqaale Mobil',
          description: 'App iOS iyo Android ah oo macaamiisha u sahla lacag-bixinta.',
          status: 'PLANNING',
          budget: '18000.00',
        },
      ],
    });
  }

  // Testimonials (W5.1) — seeded once, only when none exist yet.
  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: [
        {
          author: 'Faadumo Cabdi',
          role: 'Maamulaha Guud',
          company: 'Iskuul Gaar ah',
          quote:
            'Somwave waxay nagu dhistay nidaam maamul oo casri ah — hawshu waa fududaatay, khaladaadkuna way yaraadeen.',
          rating: 5,
          order: 1,
        },
        {
          author: 'Axmed Nuur',
          role: 'Milkiile',
          company: 'Shirkad Dhaqaale',
          quote:
            'App-ka ay noo sameeyeen macaamiisheena aad buu u helay — lacag-bixintu way fududaatay.',
          rating: 5,
          order: 2,
        },
      ],
    });
  }

  // Team members (W5.2) — seeded once, only when none exist yet.
  if ((await prisma.teamMember.count()) === 0) {
    await prisma.teamMember.createMany({
      data: [
        {
          name: 'Cabdirisaaq Warsame',
          role: 'Aasaase & Injineer Sare',
          bio: 'Wuxuu hoggaamiyaa dhisidda tignoolajiyada Somwave.',
          order: 1,
        },
        {
          name: 'Hodan Maxamed',
          role: 'Naqshadeeye UI/UX',
          bio: 'Waxay abuurtaa waxyaabo fudud oo la isticmaalo.',
          order: 2,
        },
      ],
    });
  }

  // FAQ (W5.3) — seeded once, only when none exist yet.
  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: [
        {
          question: 'Intee in le’eg ayay qaadataa in website la dhiso?',
          answer:
            'Waqtigu wuxuu ku xiran yahay baaxadda mashruuca — website fudud 2–4 toddobaad, nidaam buuxana wax ka badan.',
          order: 1,
        },
        {
          question: 'Ma bixisaan taageero ka dib markii la dhammeeyo?',
          answer:
            'Haa, waxaan bixinaa taageero iyo dayactir joogto ah si mashruucaagu si fiican u shaqeeyo.',
          order: 2,
        },
      ],
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
