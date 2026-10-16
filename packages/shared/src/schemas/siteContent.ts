import { z } from 'zod';

export const trustedBusinessIdSchema = z.enum([
  'hormuud',
  'somtel',
  'dahabshiil',
  'taaj',
  'premier-bank',
  'amal-bank',
]);
export type TrustedBusinessId = z.infer<typeof trustedBusinessIdSchema>;

const approvedImageUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => /^\/(?!\/)/.test(value) || /^https:\/\//.test(value),
    'Use an absolute site path or HTTPS image URL',
  );

const heroSlideIdSchema = z.enum(['intro', 'software', 'connected']);
export type HeroSlideId = z.infer<typeof heroSlideIdSchema>;

export const additionalHeroSlideSchema = z.object({
  id: z.enum(['software', 'connected']),
  badge: z.string().trim().min(1).max(120),
  headline: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(600),
  imageUrl: z.union([z.literal(''), approvedImageUrl]),
  imageAlt: z.string().trim().min(1).max(240),
  primaryLabel: z.string().trim().min(1).max(60),
  primaryHref: approvedImageUrl,
  secondaryLabel: z.string().trim().max(60),
  secondaryHref: z.union([z.literal(''), approvedImageUrl]),
});

export const defaultAdditionalHeroSlides: z.infer<typeof additionalHeroSlideSchema>[] = [
  {
    id: 'software',
    badge: 'Software built around your work',
    headline: 'Power Your Business with Smarter Software.',
    description:
      'Turn complex workflows into clear, reliable tools designed for the way your team works.',
    imageUrl: '/images/hero-software-1200.webp',
    imageAlt: 'Illustrative school management application on a laptop',
    primaryLabel: 'Explore Software',
    primaryHref: '/adeegyada',
    secondaryLabel: 'View Our Work',
    secondaryHref: '/shaqooyinka',
  },
  {
    id: 'connected',
    badge: 'One connected ecosystem',
    headline: 'Everything Your Business Needs. Connected.',
    description:
      'Bring websites, applications, customer tools, payments, and insights into one coherent digital experience.',
    imageUrl: '',
    imageAlt: 'Illustration of connected digital services around Somwave Solution',
    primaryLabel: 'See Our Solution',
    primaryHref: '/#solutions',
    secondaryLabel: 'Contact Us',
    secondaryHref: '/nala-soo-xiriir',
  },
];

const ecosystemItemSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(180),
  href: approvedImageUrl,
});
export const defaultEcosystem = {
  left: [
    {
      title: 'Websites',
      description: 'Business websites that build your brand and grow your reach.',
      href: '/adeegyada',
    },
    {
      title: 'Mobile Apps',
      description: 'Android and iOS applications for your business needs.',
      href: '/adeegyada',
    },
    {
      title: 'Custom Software',
      description: 'Tailored software solutions to streamline operations.',
      href: '/adeegyada',
    },
    {
      title: 'IT Consulting',
      description: 'Strategic guidance to help your business grow with technology.',
      href: '/adeegyada',
    },
  ],
  right: [
    {
      title: 'Payments',
      description: 'Secure and reliable payment solutions.',
      href: '/nala-soo-xiriir',
    },
    {
      title: 'CRM',
      description: 'Customer relationship management tools.',
      href: '/nala-soo-xiriir',
    },
    {
      title: 'Automation',
      description: 'Automate processes and save time with smart solutions.',
      href: '/nala-soo-xiriir',
    },
    {
      title: 'Analytics',
      description: 'Track performance and gain useful business insights.',
      href: '/nala-soo-xiriir',
    },
  ],
};

export const homeSectionIds = [
  'trusted',
  'introduction',
  'solutions',
  'services',
  'portfolio',
  'why',
  'process',
  'testimonials',
  'articles',
  'faq',
  'contact',
  'cta',
] as const;
export const homeSectionIdSchema = z.enum(homeSectionIds);
export type HomeSectionId = z.infer<typeof homeSectionIdSchema>;
export const homeSectionOrderSchema = z
  .array(homeSectionIdSchema)
  .length(homeSectionIds.length)
  .refine(
    (ids) => new Set(ids).size === homeSectionIds.length,
    'Include every homepage section once',
  );

export const siteContentSchema = z.object({
  sectionOrder: homeSectionOrderSchema.default([...homeSectionIds]),
  hiddenSections: z
    .array(homeSectionIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, 'Choose each hidden section once')
    .default([]),
  hero: z.object({
    badge: z.string().trim().min(1).max(120),
    headline: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(600),
    imageUrl: approvedImageUrl,
    imageAlt: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .default('Illustrative Somwave laptop and mobile application showcase'),
    primaryLabel: z.string().trim().min(1).max(60).default('Get Started'),
    primaryHref: approvedImageUrl.default('/nala-soo-xiriir'),
    secondaryLabel: z.string().trim().max(60).default('View Our Work'),
    secondaryHref: z.union([z.literal(''), approvedImageUrl]).default('/shaqooyinka'),
  }),
  heroSlides: z
    .array(additionalHeroSlideSchema)
    .length(2)
    .refine(
      (slides) => new Set(slides.map((slide) => slide.id)).size === 2,
      'Configure software and connected slides once each',
    )
    .default(defaultAdditionalHeroSlides),
  heroSlideOrder: z
    .array(heroSlideIdSchema)
    .length(3)
    .refine((ids) => new Set(ids).size === 3, 'Each slide must appear once')
    .default(['intro', 'software', 'connected']),
  ecosystem: z
    .object({
      left: z.array(ecosystemItemSchema).length(4),
      right: z.array(ecosystemItemSchema).length(4),
    })
    .default(defaultEcosystem),
  cta: z.object({
    headline: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(600),
    backgroundImageUrl: z.union([z.literal(''), approvedImageUrl]),
  }),
  contact: z.object({
    location: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(254),
    phone: z
      .string()
      .trim()
      .regex(/^[+0-9 ()-]{6,30}$/),
    social: z
      .array(
        z.object({
          label: z.enum(['Facebook', 'Instagram', 'LinkedIn', 'X']),
          url: z.string().url().startsWith('https://'),
        }),
      )
      .max(4),
  }),
  trusted: z.object({
    approved: z.boolean(),
    assetUrls: z.record(trustedBusinessIdSchema, approvedImageUrl).default({}),
    visibleIds: z
      .array(trustedBusinessIdSchema)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each logo once'),
  }),
});

export type SiteContent = z.infer<typeof siteContentSchema>;

export const defaultSiteContent: SiteContent = {
  sectionOrder: [...homeSectionIds],
  hiddenSections: [],
  hero: {
    badge: 'Technology partner for growing businesses',
    headline: 'Innovative Technology Solutions for a Brighter Tomorrow.',
    description:
      'Somwave Solution delivers modern websites, mobile applications, custom software, and IT solutions that help businesses grow, operate smarter, and reach more people.',
    imageUrl: '/images/hero-devices-1200.webp',
    imageAlt: 'Illustrative Somwave laptop and mobile application showcase',
    primaryLabel: 'Get Started',
    primaryHref: '/nala-soo-xiriir',
    secondaryLabel: 'View Our Work',
    secondaryHref: '/shaqooyinka',
  },
  heroSlides: defaultAdditionalHeroSlides,
  heroSlideOrder: ['intro', 'software', 'connected'],
  ecosystem: defaultEcosystem,
  cta: {
    headline: 'Ready to Transform Your Business?',
    description:
      'Tell us what you are building, and let’s explore the right digital solution together.',
    backgroundImageUrl: '',
  },
  contact: {
    location: 'Mogadishu, Somalia',
    email: 'info@somwave.so',
    phone: '614696302',
    social: [],
  },
  trusted: {
    approved: true,
    assetUrls: {},
    visibleIds: ['hormuud', 'somtel', 'dahabshiil', 'taaj', 'premier-bank', 'amal-bank'],
  },
};
