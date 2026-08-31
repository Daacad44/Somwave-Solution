// CMS routes (W4, §9, §10). Authenticated content management, gated behind the
// content.* permissions (held by EDITOR). Mounted under /api/v1/cms.
import { Router } from 'express';
import {
  createServiceSchema,
  updateServiceSchema,
  createPostSchema,
  updatePostSchema,
  createPortfolioItemSchema,
  updatePortfolioItemSchema,
  createJobOpeningSchema,
  updateJobOpeningSchema,
  PERMISSIONS,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as cmsController from '../controllers/cms.controller';

export const cmsRouter: Router = Router();

cmsRouter.use(requireAuth);

cmsRouter.get('/services', rbac(PERMISSIONS.CONTENT_READ), cmsController.listServices);
cmsRouter.post(
  '/services',
  rbac(PERMISSIONS.CONTENT_CREATE),
  validate(createServiceSchema),
  cmsController.createService,
);
cmsRouter.patch(
  '/services/:id',
  rbac(PERMISSIONS.CONTENT_UPDATE),
  validate(updateServiceSchema),
  cmsController.updateService,
);
cmsRouter.delete('/services/:id', rbac(PERMISSIONS.CONTENT_DELETE), cmsController.deleteService);

cmsRouter.get('/categories', rbac(PERMISSIONS.CONTENT_READ), cmsController.listCategories);

cmsRouter.get('/posts', rbac(PERMISSIONS.CONTENT_READ), cmsController.listPosts);
cmsRouter.post(
  '/posts',
  rbac(PERMISSIONS.CONTENT_CREATE),
  validate(createPostSchema),
  cmsController.createPost,
);
cmsRouter.patch(
  '/posts/:id',
  rbac(PERMISSIONS.CONTENT_UPDATE),
  validate(updatePostSchema),
  cmsController.updatePost,
);
cmsRouter.delete('/posts/:id', rbac(PERMISSIONS.CONTENT_DELETE), cmsController.deletePost);

cmsRouter.get('/portfolio', rbac(PERMISSIONS.CONTENT_READ), cmsController.listPortfolio);
cmsRouter.post(
  '/portfolio',
  rbac(PERMISSIONS.CONTENT_CREATE),
  validate(createPortfolioItemSchema),
  cmsController.createPortfolio,
);
cmsRouter.patch(
  '/portfolio/:id',
  rbac(PERMISSIONS.CONTENT_UPDATE),
  validate(updatePortfolioItemSchema),
  cmsController.updatePortfolio,
);
cmsRouter.delete('/portfolio/:id', rbac(PERMISSIONS.CONTENT_DELETE), cmsController.deletePortfolio);

cmsRouter.get('/careers', rbac(PERMISSIONS.CONTENT_READ), cmsController.listOpenings);
cmsRouter.post(
  '/careers',
  rbac(PERMISSIONS.CONTENT_CREATE),
  validate(createJobOpeningSchema),
  cmsController.createOpening,
);
cmsRouter.patch(
  '/careers/:id',
  rbac(PERMISSIONS.CONTENT_UPDATE),
  validate(updateJobOpeningSchema),
  cmsController.updateOpening,
);
cmsRouter.delete('/careers/:id', rbac(PERMISSIONS.CONTENT_DELETE), cmsController.deleteOpening);
