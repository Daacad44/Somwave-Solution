// Public, unauthenticated, cached, rate-limited routes (SYSTEM_PROMPT §5, §10):
// everything under /api/v1/public/*.
import { Router } from 'express';
import {
  createInquirySchema,
  createJobApplicationSchema,
  createSubscriberSchema,
  createProjectInquirySchema,
  verifyProjectInquirySchema,
  activateProjectInquirySchema,
} from '@somwave/shared';
import { publicRateLimiter, submissionRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import * as publicController from '../controllers/public.controller';
import * as projectInquiryController from '../controllers/project-inquiry.controller';
import { loginIpRateLimiter } from '../middleware/rateLimit';

export const publicRouter: Router = Router();

publicRouter.use(publicRateLimiter);

publicRouter.get('/homepage', publicController.getHomepage);

publicRouter.get('/site-content', publicController.getSiteContent);

publicRouter.get('/services', publicController.getServices);
publicRouter.get('/services/:slug', publicController.getService);

publicRouter.get('/portfolio', publicController.getPortfolio);
publicRouter.get('/portfolio/:slug', publicController.getPortfolioItem);
publicRouter.post('/portfolio/:id/demo-click', publicController.recordDemoClick);

publicRouter.get('/posts', publicController.getPosts);
publicRouter.get('/posts/:slug', publicController.getPost);
publicRouter.get('/article-images/:id', publicController.getArticleImage);

publicRouter.get('/testimonials', publicController.getTestimonials);
publicRouter.get('/team', publicController.getTeam);
publicRouter.get('/faqs', publicController.getFaqs);

publicRouter.get('/careers', publicController.getCareers);
publicRouter.get('/careers/:slug', publicController.getCareer);
publicRouter.post(
  '/careers/:slug/applications',
  submissionRateLimiter,
  validate(createJobApplicationSchema),
  publicController.applyToCareer,
);

publicRouter.post(
  '/inquiries',
  submissionRateLimiter,
  validate(createInquirySchema),
  publicController.createInquiry,
);

publicRouter.post(
  '/project-inquiries',
  submissionRateLimiter,
  validate(createProjectInquirySchema),
  projectInquiryController.create,
);
publicRouter.post(
  '/project-inquiries/:id/resend',
  submissionRateLimiter,
  projectInquiryController.resend,
);
publicRouter.post(
  '/project-inquiries/:id/verify',
  loginIpRateLimiter,
  validate(verifyProjectInquirySchema),
  projectInquiryController.verify,
);
publicRouter.post(
  '/project-inquiries/:id/activate',
  loginIpRateLimiter,
  validate(activateProjectInquirySchema),
  projectInquiryController.activate,
);

publicRouter.post(
  '/subscribers',
  submissionRateLimiter,
  validate(createSubscriberSchema),
  publicController.subscribe,
);
