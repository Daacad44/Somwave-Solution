// User & role management routes (I1, §10). Every route authenticates, then
// re-checks the required permission on the server (§13) — a hidden button is not
// authorisation. Mounted under /api/v1/users and /api/v1/roles.
import { Router } from 'express';
import { createUserSchema, updateUserSchema, PERMISSIONS } from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as userController from '../controllers/user.controller';

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', rbac(PERMISSIONS.USERS_READ), userController.list);
usersRouter.post(
  '/',
  rbac(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  userController.create,
);
usersRouter.get('/:id', rbac(PERMISSIONS.USERS_READ), userController.get);
usersRouter.patch(
  '/:id',
  rbac(PERMISSIONS.USERS_UPDATE),
  validate(updateUserSchema),
  userController.update,
);
usersRouter.delete('/:id', rbac(PERMISSIONS.USERS_DELETE), userController.remove);

export const rolesRouter: Router = Router();

rolesRouter.use(requireAuth);
rolesRouter.get('/', rbac(PERMISSIONS.ROLES_READ), userController.listRoles);
