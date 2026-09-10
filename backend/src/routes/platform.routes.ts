import { Router } from 'express';
import {
  PERMISSIONS,
  updateInquirySchema,
  updateJobApplicationSchema,
  createClientSchema,
  updateClientSchema,
  createTimesheetSchema,
  updateTimesheetSchema,
  createInvoiceSchema,
  createTicketSchema,
  updateTicketSchema,
} from '@somwave/shared';
import { requireAuth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as leadController from '../controllers/lead.controller';
import * as applicationController from '../controllers/application.controller';
import * as clientController from '../controllers/client.controller';
import * as timesheetController from '../controllers/timesheet.controller';
import * as invoiceController from '../controllers/invoice.controller';
import * as ticketController from '../controllers/ticket.controller';
import * as portalController from '../controllers/portal.controller';

export const leadsRouter: Router = Router();
leadsRouter.use(requireAuth);
leadsRouter.get('/', rbac(PERMISSIONS.LEADS_READ), leadController.list);
leadsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.LEADS_UPDATE),
  validate(updateInquirySchema),
  leadController.update,
);

export const applicationsRouter: Router = Router();
applicationsRouter.use(requireAuth);
applicationsRouter.get('/', rbac(PERMISSIONS.APPLICATIONS_READ), applicationController.list);
applicationsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.APPLICATIONS_UPDATE),
  validate(updateJobApplicationSchema),
  applicationController.update,
);

export const clientsRouter: Router = Router();
clientsRouter.use(requireAuth);
clientsRouter.get('/', rbac(PERMISSIONS.CLIENTS_READ), clientController.list);
clientsRouter.post(
  '/',
  rbac(PERMISSIONS.CLIENTS_CREATE),
  validate(createClientSchema),
  clientController.create,
);
clientsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.CLIENTS_UPDATE),
  validate(updateClientSchema),
  clientController.update,
);

export const timesheetsRouter: Router = Router();
timesheetsRouter.use(requireAuth);
timesheetsRouter.get('/', rbac(PERMISSIONS.TIMESHEETS_READ), timesheetController.list);
timesheetsRouter.post(
  '/',
  rbac(PERMISSIONS.TIMESHEETS_CREATE),
  validate(createTimesheetSchema),
  timesheetController.create,
);
timesheetsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.TIMESHEETS_UPDATE),
  validate(updateTimesheetSchema),
  timesheetController.update,
);

export const invoicesRouter: Router = Router();
invoicesRouter.use(requireAuth);
invoicesRouter.get('/', rbac(PERMISSIONS.INVOICES_READ), invoiceController.list);
invoicesRouter.post(
  '/',
  rbac(PERMISSIONS.INVOICES_CREATE),
  validate(createInvoiceSchema),
  invoiceController.create,
);

export const ticketsRouter: Router = Router();
ticketsRouter.use(requireAuth);
ticketsRouter.get('/', rbac(PERMISSIONS.TICKETS_READ), ticketController.list);
ticketsRouter.post(
  '/',
  rbac(PERMISSIONS.TICKETS_CREATE),
  validate(createTicketSchema),
  ticketController.create,
);
ticketsRouter.patch(
  '/:id',
  rbac(PERMISSIONS.TICKETS_UPDATE),
  validate(updateTicketSchema),
  ticketController.update,
);

export const portalRouter: Router = Router();
portalRouter.use(requireAuth);
portalRouter.get('/projects', rbac(PERMISSIONS.PORTAL_READ), portalController.listProjects);
