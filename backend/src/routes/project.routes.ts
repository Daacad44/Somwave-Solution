// Projects routes (I2.1, §10). Every route authenticates, then re-checks the
// required permission on the server (§13). Mounted under /api/v1/projects.
import { Router } from 'express';
import { createProjectSchema, updateProjectSchema, PERMISSIONS } from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as projectController from '../controllers/project.controller';

export const projectsRouter: Router = Router();

projectsRouter.use(requireAuth);

projectsRouter.get('/', rbac(PERMISSIONS.PROJECTS_READ), projectController.list);
projectsRouter.post(
  '/',
  rbac(PERMISSIONS.PROJECTS_CREATE),
  validate(createProjectSchema),
  projectController.create,
);
projectsRouter.get('/:id', rbac(PERMISSIONS.PROJECTS_READ), projectController.get);
projectsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.PROJECTS_UPDATE),
  validate(updateProjectSchema),
  projectController.update,
);
projectsRouter.delete('/:id', rbac(PERMISSIONS.PROJECTS_DELETE), projectController.remove);
