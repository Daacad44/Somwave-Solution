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
  PaymentRecord,
  RecordPaymentInput,
  ChargeEvcPaymentInput,
  AdminTicket,
  TicketDetail,
  CreateTicketInput,
  UpdateTicketInput,
  CreateTicketReplyInput,
  AdminProject,
  AdminMilestone,
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
export function recordPayment(
  input: RecordPaymentInput,
  idempotencyKey: string,
): Promise<PaymentRecord> {
  return apiFetch<PaymentRecord>('/payments', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function chargeEvcPayment(
  input: ChargeEvcPaymentInput,
  idempotencyKey: string,
): Promise<PaymentRecord> {
  return apiFetch<PaymentRecord>('/payments/evc-plus', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function listTickets(): Promise<AdminTicket[]> {
  return apiFetch<AdminTicket[]>('/support-tickets');
}
export function getTicket(id: string): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/support-tickets/${id}`);
}
export function createTicket(input: CreateTicketInput): Promise<AdminTicket> {
  return apiFetch<AdminTicket>('/support-tickets', { method: 'POST', body: JSON.stringify(input) });
}
export function updateTicket(id: string, input: UpdateTicketInput): Promise<AdminTicket> {
  return apiFetch<AdminTicket>(`/support-tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
export function listTicketAssignees(): Promise<{ id: string; name: string }[]> {
  return apiFetch<{ id: string; name: string }[]>('/support-tickets/assignees');
}
export function createTicketReply(
  id: string,
  input: CreateTicketReplyInput,
): Promise<{ id: string; body: string; createdAt: string; author: { id: string; name: string } }> {
  return apiFetch(`/support-tickets/${id}/replies`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listPortalProjects(): Promise<AdminProject[]> {
  return apiFetch<AdminProject[]>('/portal/projects');
}
export function listPortalMilestones(): Promise<AdminMilestone[]> {
  return apiFetch<AdminMilestone[]>('/portal/milestones');
}
