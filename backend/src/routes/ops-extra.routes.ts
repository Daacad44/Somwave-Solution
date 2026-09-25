import { Router } from 'express';
import {
  PERMISSIONS,
  checkInSchema,
  createDocumentSchema,
  createEmployeeSchema,
  createLeaveRequestSchema,
  createMediaAssetSchema,
  updateEmployeeSchema,
  updateLeaveRequestSchema,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as ctrl from '../controllers/ops-extra.controller';

export const employeesRouter = Router();
employeesRouter.use(requireAuth);
employeesRouter.get('/', rbac(PERMISSIONS.EMPLOYEES_READ), ctrl.listEmployees);
employeesRouter.get('/candidates', rbac(PERMISSIONS.EMPLOYEES_CREATE), ctrl.listEmployeeCandidates);
employeesRouter.post(
  '/',
  rbac(PERMISSIONS.EMPLOYEES_CREATE),
  validate(createEmployeeSchema),
  ctrl.createEmployee,
);
employeesRouter.patch(
  '/:id',
  rbac(PERMISSIONS.EMPLOYEES_UPDATE),
  validate(updateEmployeeSchema),
  ctrl.updateEmployee,
);

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);
attendanceRouter.get('/', rbac(PERMISSIONS.ATTENDANCE_READ), ctrl.listAttendance);
attendanceRouter.post(
  '/check-in',
  rbac(PERMISSIONS.ATTENDANCE_CREATE),
  validate(checkInSchema),
  ctrl.checkIn,
);
attendanceRouter.post(
  '/check-out',
  rbac(PERMISSIONS.ATTENDANCE_CREATE),
  validate(checkInSchema),
  ctrl.checkOut,
);

export const leaveRouter = Router();
leaveRouter.use(requireAuth);
leaveRouter.get('/', rbac(PERMISSIONS.LEAVE_READ), ctrl.listLeave);
leaveRouter.post(
  '/',
  rbac(PERMISSIONS.LEAVE_CREATE),
  validate(createLeaveRequestSchema),
  ctrl.createLeave,
);
leaveRouter.patch(
  '/:id',
  rbac(PERMISSIONS.LEAVE_UPDATE),
  validate(updateLeaveRequestSchema),
  ctrl.updateLeave,
);

export const documentsRouter = Router();
documentsRouter.use(requireAuth);
documentsRouter.get('/', rbac(PERMISSIONS.DOCUMENTS_READ), ctrl.listDocuments);
documentsRouter.post(
  '/',
  rbac(PERMISSIONS.DOCUMENTS_CREATE),
  validate(createDocumentSchema),
  ctrl.createDocument,
);
documentsRouter.get('/:id/file', rbac(PERMISSIONS.DOCUMENTS_READ), ctrl.downloadDocument);
documentsRouter.delete('/:id', rbac(PERMISSIONS.DOCUMENTS_DELETE), ctrl.deleteDocument);

export const mediaRouter = Router();
mediaRouter.use(requireAuth);
mediaRouter.get('/', rbac(PERMISSIONS.MEDIA_READ), ctrl.listMedia);
mediaRouter.post(
  '/',
  rbac(PERMISSIONS.MEDIA_CREATE),
  validate(createMediaAssetSchema),
  ctrl.createMedia,
);
mediaRouter.get('/:id/file', rbac(PERMISSIONS.MEDIA_READ), ctrl.downloadMedia);
mediaRouter.delete('/:id', rbac(PERMISSIONS.MEDIA_DELETE), ctrl.deleteMedia);

export const auditRouter = Router();
auditRouter.use(requireAuth);
auditRouter.get('/', rbac(PERMISSIONS.AUDIT_READ), ctrl.listAudit);

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', rbac(PERMISSIONS.NOTIFICATIONS_READ), ctrl.listNotifications);
notificationsRouter.post('/:id/read', rbac(PERMISSIONS.NOTIFICATIONS_READ), ctrl.readNotification);
