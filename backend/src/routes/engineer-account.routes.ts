import { Router } from 'express';
import {
  createEngineerAccountSchema,
  updateEngineerAccountSchema,
  PERMISSIONS,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as controller from '../controllers/engineer-account.controller';

export const engineerAccountRouter: Router = Router();
engineerAccountRouter.use(requireAuth, rbac(PERMISSIONS.ENGINEERING_MANAGE));
engineerAccountRouter.get('/', controller.list);
engineerAccountRouter.post('/', validate(createEngineerAccountSchema), controller.create);
engineerAccountRouter.get('/:userId', controller.detail);
engineerAccountRouter.patch('/:userId', validate(updateEngineerAccountSchema), controller.update);
engineerAccountRouter.get('/:userId/activity', controller.activity);
engineerAccountRouter.post('/:userId/resend', controller.resend);
engineerAccountRouter.post('/:userId/cancel', controller.cancel);
engineerAccountRouter.post('/:userId/suspend', controller.suspend);
engineerAccountRouter.post('/:userId/reactivate', controller.reactivate);
