import type {
  AdminInquiry,
  UpdateInquiryInput,
  AdminJobApplication,
  UpdateJobApplicationInput,
  AdminClient,
  CreateClientInput,
  AdminTimesheet,
  CreateTimesheetInput,
  UpdateTimesheetInput,
  AdminInvoice,
  InvoiceDetail,
  CreateInvoiceInput,
  AdminTicket,
  CreateTicketInput,
  AdminProject,
} from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';

export function listLeads(): Promise<AdminInquiry[]> {
  return apiFetch<AdminInquiry[]>('/leads');
}
export function updateLead(id: string, input: UpdateInquiryInput): Promise<AdminInquiry> {
  return apiFetch<AdminInquiry>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function listApplications(): Promise<AdminJobApplication[]> {
  return apiFetch<AdminJobApplication[]>('/job-applications');
}
export function updateApplication(
  id: string,
  input: UpdateJobApplicationInput,
): Promise<AdminJobApplication> {
  return apiFetch<AdminJobApplication>(`/job-applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listClients(): Promise<AdminClient[]> {
  return apiFetch<AdminClient[]>('/clients');
}
export function createClient(input: CreateClientInput): Promise<AdminClient> {
  return apiFetch<AdminClient>('/clients', { method: 'POST', body: JSON.stringify(input) });
}

export function listTimesheets(): Promise<AdminTimesheet[]> {
  return apiFetch<AdminTimesheet[]>('/timesheets');
}
export function createTimesheet(input: CreateTimesheetInput): Promise<AdminTimesheet> {
  return apiFetch<AdminTimesheet>('/timesheets', { method: 'POST', body: JSON.stringify(input) });
}
export function updateTimesheet(id: string, input: UpdateTimesheetInput): Promise<AdminTimesheet> {
  return apiFetch<AdminTimesheet>(`/timesheets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listInvoices(): Promise<AdminInvoice[]> {
  return apiFetch<AdminInvoice[]>('/invoices');
}
export function getInvoice(id: string): Promise<InvoiceDetail> {
  return apiFetch<InvoiceDetail>(`/invoices/${id}`);
}
export function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetail> {
  return apiFetch<InvoiceDetail>('/invoices', { method: 'POST', body: JSON.stringify(input) });
}
export function sendInvoice(id: string, idempotencyKey: string): Promise<InvoiceDetail> {
  return apiFetch<InvoiceDetail>(`/invoices/${id}/send`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({}),
  });
}
export function voidInvoice(id: string): Promise<InvoiceDetail> {
  return apiFetch<InvoiceDetail>(`/invoices/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function listTickets(): Promise<AdminTicket[]> {
  return apiFetch<AdminTicket[]>('/support-tickets');
}
export function createTicket(input: CreateTicketInput): Promise<AdminTicket> {
  return apiFetch<AdminTicket>('/support-tickets', { method: 'POST', body: JSON.stringify(input) });
}

export function listPortalProjects(): Promise<AdminProject[]> {
  return apiFetch<AdminProject[]>('/portal/projects');
}
