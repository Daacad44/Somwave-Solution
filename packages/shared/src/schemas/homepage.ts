import { z } from 'zod';
import { publicFaqSchema } from './faq';
import { publicPortfolioItemSchema } from './portfolio';
import { publicPostSummarySchema } from './post';
import { publicServiceSchema } from './service';
import { siteContentSchema } from './siteContent';
import { publicTestimonialSchema } from './testimonial';

// Null means a CMS query failed; an empty array means it succeeded with no content.
export const publicHomepageSchema = z.object({
  siteContent: siteContentSchema,
  services: z.array(publicServiceSchema).nullable(),
  portfolio: z.array(publicPortfolioItemSchema).nullable(),
  testimonials: z.array(publicTestimonialSchema).nullable(),
  posts: z.array(publicPostSummarySchema).nullable(),
  faqs: z.array(publicFaqSchema).nullable(),
});

export type PublicHomepage = z.infer<typeof publicHomepageSchema>;
