import { Router } from 'express';
import {
  connectGitHubInstallationSchema,
  createGitHubTaskLinkSchema,
  mapGitHubRepositorySchema,
  PERMISSIONS,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as controller from '../controllers/github.controller';

export const githubRouter: Router = Router();
export const githubWebhooksRouter: Router = Router();

githubWebhooksRouter.post('/', controller.receiveWebhook);

githubRouter.use(requireAuth);
githubRouter.get('/installations', rbac(PERMISSIONS.GITHUB_MANAGE), controller.listInstallations);
githubRouter.post(
  '/installations',
  rbac(PERMISSIONS.GITHUB_MANAGE),
  validate(connectGitHubInstallationSchema),
  controller.connectInstallation,
);
githubRouter.delete(
  '/installations/:installationId',
  rbac(PERMISSIONS.GITHUB_MANAGE),
  controller.disconnectInstallation,
);
githubRouter.get('/repositories', rbac(PERMISSIONS.GITHUB_READ), controller.listRepositories);
githubRouter.get(
  '/repositories/:repositoryId/activity/:kind',
  rbac(PERMISSIONS.GITHUB_READ),
  controller.listRepositoryActivity,
);
githubRouter.patch(
  '/repositories/:repositoryId',
  rbac(PERMISSIONS.GITHUB_MANAGE),
  validate(mapGitHubRepositorySchema),
  controller.mapRepository,
);
githubRouter.get('/tasks/:taskId/links', rbac(PERMISSIONS.GITHUB_READ), controller.listTaskLinks);
githubRouter.post(
  '/tasks/:taskId/links',
  rbac(PERMISSIONS.GITHUB_MANAGE),
  validate(createGitHubTaskLinkSchema),
  controller.createTaskLink,
);
githubRouter.delete(
  '/tasks/:taskId/links/:linkId',
  rbac(PERMISSIONS.GITHUB_MANAGE),
  controller.removeTaskLink,
);
