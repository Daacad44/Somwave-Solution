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

export const siteContentSchema = z.object({
  hero: z.object({
    badge: z.string().trim().min(1).max(120),
    headline: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(600),
    imageUrl: approvedImageUrl,
  }),
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
    visibleIds: z
      .array(trustedBusinessIdSchema)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each logo once'),
  }),
});

export type SiteContent = z.infer<typeof siteContentSchema>;

export const defaultSiteContent: SiteContent = {
  hero: {
    badge: 'Technology partner for growing businesses',
    headline: 'Innovative Technology Solutions for a Brighter Tomorrow.',
    description:
      'Somwave Solution delivers modern websites, mobile applications, custom software, and IT solutions that help businesses grow, operate smarter, and reach more people.',
    imageUrl: '/images/hero-somwave.png',
  },
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
    visibleIds: ['hormuud', 'somtel', 'dahabshiil', 'taaj', 'premier-bank', 'amal-bank'],
  },
};
