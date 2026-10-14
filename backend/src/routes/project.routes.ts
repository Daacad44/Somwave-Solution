// Projects routes (I2.1, §10). Every route authenticates, then re-checks the
// required permission on the server (§13). Mounted under /api/v1/projects.
import { Router } from 'express';
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectHealthNoteSchema,
  PERMISSIONS,
  createProjectExpenseSchema,
  reviseProjectBudgetSchema,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as projectController from '../controllers/project.controller';

export const projectsRouter: Router = Router();

projectsRouter.use(requireAuth);

projectsRouter.get('/', rbac(PERMISSIONS.PROJECTS_READ), projectController.list);
projectsRouter.get('/portfolio', rbac(PERMISSIONS.PROJECTS_READ), projectController.portfolio);
projectsRouter.get('/:id/finance', rbac(PERMISSIONS.INVOICES_READ), projectController.finance);
projectsRouter.get('/:id/activity', rbac(PERMISSIONS.PROJECTS_READ), projectController.activity);
projectsRouter.post(
  '/:id/expenses',
  rbac(PERMISSIONS.INVOICES_UPDATE),
  validate(createProjectExpenseSchema),
  projectController.createExpense,
);
projectsRouter.delete(
  '/:id/expenses/:expenseId',
  rbac(PERMISSIONS.INVOICES_UPDATE),
  projectController.removeExpense,
);
projectsRouter.post(
  '/:id/budget-revisions',
  rbac(PERMISSIONS.INVOICES_UPDATE),
  validate(reviseProjectBudgetSchema),
  projectController.reviseBudget,
);
projectsRouter.post(
  '/',
  rbac(PERMISSIONS.PROJECTS_CREATE),
  validate(createProjectSchema),
  projectController.create,
);
projectsRouter.get('/:id/workspace', rbac(PERMISSIONS.PROJECTS_READ), projectController.workspace);
projectsRouter.get('/:id', rbac(PERMISSIONS.PROJECTS_READ), projectController.get);
projectsRouter.patch(
  '/:id/health-note',
  rbac(PERMISSIONS.PROJECTS_UPDATE),
  validate(updateProjectHealthNoteSchema),
  projectController.updateHealthNote,
);
projectsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.PROJECTS_UPDATE),
  validate(updateProjectSchema),
  projectController.update,
);
projectsRouter.delete('/:id', rbac(PERMISSIONS.PROJECTS_DELETE), projectController.remove);
