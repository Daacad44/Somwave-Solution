import { Router } from 'express';
import {
  changeProjectDocumentationStatusSchema,
  createProjectDocumentationSchema,
  updateProjectDocumentationSchema,
  createDocumentationCommentSchema,
  updateDocumentationCommentSchema,
  documentationLinkSchema,
  renameDocumentationFolderSchema,
  createDocumentPlanSchema,
  reviewDocumentPlanSchema,
  documentationAttachmentSchema,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as controller from '../controllers/project-documentation.controller';
import * as planController from '../controllers/document-plan.controller';

// Mount at /api/v1/projects. Service checks project membership and role for
// every operation, including downloads and version history.
export const projectDocumentationRouter: Router = Router();
projectDocumentationRouter.use(requireAuth);
projectDocumentationRouter.get('/:projectId/documentation', controller.list);
projectDocumentationRouter.get('/:projectId/documentation/folders', controller.folders);
projectDocumentationRouter.patch(
  '/:projectId/documentation/folders/rename',
  validate(renameDocumentationFolderSchema),
  controller.renameFolder,
);
projectDocumentationRouter.post(
  '/:projectId/documentation',
  validate(createProjectDocumentationSchema),
  controller.create,
);
projectDocumentationRouter.get('/:projectId/documentation/:documentId', controller.get);
projectDocumentationRouter.patch(
  '/:projectId/documentation/:documentId',
  validate(updateProjectDocumentationSchema),
  controller.update,
);
projectDocumentationRouter.delete('/:projectId/documentation/:documentId', controller.remove);
projectDocumentationRouter.get(
  '/:projectId/documentation/:documentId/versions',
  controller.versions,
);
projectDocumentationRouter.get('/:projectId/documentation/:documentId/file', controller.file);
projectDocumentationRouter.get(
  '/:projectId/documentation/:documentId/attachments',
  controller.attachments,
);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/attachments',
  validate(documentationAttachmentSchema),
  controller.addAttachment,
);
projectDocumentationRouter.delete(
  '/:projectId/documentation/:documentId/attachments/:fileDocumentId',
  controller.removeAttachment,
);
projectDocumentationRouter.get(
  '/:projectId/documentation/:documentId/comments',
  controller.comments,
);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/comments',
  validate(createDocumentationCommentSchema),
  controller.addComment,
);
projectDocumentationRouter.patch(
  '/:projectId/documentation/:documentId/comments/:commentId',
  validate(updateDocumentationCommentSchema),
  controller.editComment,
);
projectDocumentationRouter.delete(
  '/:projectId/documentation/:documentId/comments/:commentId',
  controller.removeComment,
);
projectDocumentationRouter.get('/:projectId/documentation/:documentId/links', controller.links);
projectDocumentationRouter.get('/:projectId/documentation/:documentId/plans', planController.list);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/plans',
  validate(createDocumentPlanSchema),
  planController.create,
);
projectDocumentationRouter.get(
  '/:projectId/documentation/:documentId/plans/:planId',
  planController.get,
);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/plans/:planId/activate',
  validate(reviewDocumentPlanSchema),
  planController.activate,
);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/plans/:planId/reject',
  validate(reviewDocumentPlanSchema),
  planController.reject,
);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/propose-tasks',
  controller.proposeTasks,
);
projectDocumentationRouter.post(
  '/:projectId/documentation/:documentId/links/:target',
  validate(documentationLinkSchema),
  controller.addLink,
);
projectDocumentationRouter.delete(
  '/:projectId/documentation/:documentId/links/:target/:targetId',
  controller.removeLink,
);
projectDocumentationRouter.patch(
  '/:projectId/documentation/:documentId/status',
  validate(changeProjectDocumentationStatusSchema),
  controller.changeStatus,
);
