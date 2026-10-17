// User & role management routes (I1, §10). Every route authenticates, then
// re-checks the required permission on the server (§13) — a hidden button is not
// authorisation. Mounted under /api/v1/users and /api/v1/roles.
import { Router } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  updateRolePermissionsSchema,
  PERMISSIONS,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as invitations from '../services/user-invitation.service';
import { sendData } from '../lib/http';
import * as userController from '../controllers/user.controller';
import * as roleController from '../controllers/role.controller';

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', rbac(PERMISSIONS.USERS_READ), userController.list);
usersRouter.post(
  '/',
  rbac(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  userController.create,
);
usersRouter.get('/invitations', rbac(PERMISSIONS.USERS_READ), async (_req, res, next) => {
  try {
    sendData(res, await invitations.listInvitations());
  } catch (e) {
    next(e);
  }
});
for (const action of ['resend', 'cancel'] as const)
  usersRouter.post(
    `/invitations/:id/${action}`,
    rbac(PERMISSIONS.USERS_CREATE),
    async (req, res, next) => {
      try {
        sendData(res, await invitations.manageInvitation(req.params.id!, action, req.authUser!));
      } catch (e) {
        next(e);
      }
    },
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
rolesRouter.get('/:id', rbac(PERMISSIONS.ROLES_READ), roleController.get);
rolesRouter.put(
  '/:id/permissions',
  rbac(PERMISSIONS.ROLES_MANAGE),
  validate(updateRolePermissionsSchema),
  roleController.setPermissions,
);

// The RBAC vocabulary itself — read-only, gated behind roles.read.
export const permissionsRouter: Router = Router();

permissionsRouter.use(requireAuth);
permissionsRouter.get('/', rbac(PERMISSIONS.ROLES_READ), roleController.listPermissions);
