// CMS routes (W4, §9, §10). Authenticated content management, gated behind the
// content.* permissions (held by EDITOR). Mounted under /api/v1/cms.
import { Router } from 'express';
import { createServiceSchema, updateServiceSchema, PERMISSIONS } from '@somwave/shared';
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
