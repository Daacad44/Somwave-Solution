// Milestones routes (I2.3, §10). Every route authenticates, then re-checks the
// required permission on the server (§13). Mounted under /api/v1/milestones.
import { Router } from 'express';
import { createMilestoneSchema, updateMilestoneSchema, PERMISSIONS } from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as milestoneController from '../controllers/milestone.controller';

export const milestonesRouter: Router = Router();

milestonesRouter.use(requireAuth);

milestonesRouter.get('/', rbac(PERMISSIONS.MILESTONES_READ), milestoneController.list);
milestonesRouter.post(
  '/',
  rbac(PERMISSIONS.MILESTONES_CREATE),
  validate(createMilestoneSchema),
  milestoneController.create,
);
milestonesRouter.get('/:id', rbac(PERMISSIONS.MILESTONES_READ), milestoneController.get);
milestonesRouter.patch(
  '/:id',
  rbac(PERMISSIONS.MILESTONES_UPDATE),
  validate(updateMilestoneSchema),
  milestoneController.update,
);
milestonesRouter.delete('/:id', rbac(PERMISSIONS.MILESTONES_DELETE), milestoneController.remove);
