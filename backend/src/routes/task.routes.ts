// Tasks routes (I2.2, §10). Every route authenticates, then re-checks the
// required permission on the server (§13). Mounted under /api/v1/tasks.
import { Router } from 'express';
import { createTaskSchema, updateTaskSchema, PERMISSIONS } from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as taskController from '../controllers/task.controller';

export const tasksRouter: Router = Router();

tasksRouter.use(requireAuth);

tasksRouter.get('/', rbac(PERMISSIONS.TASKS_READ), taskController.list);
tasksRouter.post(
  '/',
  rbac(PERMISSIONS.TASKS_CREATE),
  validate(createTaskSchema),
  taskController.create,
);
tasksRouter.get('/:id', rbac(PERMISSIONS.TASKS_READ), taskController.get);
tasksRouter.patch(
  '/:id',
  rbac(PERMISSIONS.TASKS_UPDATE),
  validate(updateTaskSchema),
  taskController.update,
);
tasksRouter.delete('/:id', rbac(PERMISSIONS.TASKS_DELETE), taskController.remove);
