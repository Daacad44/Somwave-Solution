import type {
  AdminInquiry,
  ClientProfile,
  ConvertLeadResult,
  ProjectWorkspace,
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
  ProjectInquirySummary,
  ProjectInquiryStatus,
} from '@somwave/shared';
import { apiDownload, apiFetch, apiFetchPaged, type PaginationMeta } from '../../lib/apiClient';

export function listLeads(): Promise<AdminInquiry[]> {
  return apiFetch<AdminInquiry[]>('/leads');
}
export function updateLead(id: string, input: UpdateInquiryInput): Promise<AdminInquiry> {
  return apiFetch<AdminInquiry>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export function convertLead(id: string): Promise<ConvertLeadResult> {
  return apiFetch<ConvertLeadResult>(`/leads/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function listAdminProjectInquiries(): Promise<ProjectInquirySummary[]> {
  return apiFetch<ProjectInquirySummary[]>('/leads/project-inquiries');
}
export function reviewProjectInquiry(
  id: string,
  input: {
    status: 'UNDER_REVIEW' | 'PROPOSAL_SENT' | 'REJECTED' | 'CANCELLED';
    proposalSummary?: string;
  },
): Promise<ProjectInquirySummary> {
  return apiFetch<ProjectInquirySummary>(`/leads/project-inquiries/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
export function convertProjectInquiry(
  id: string,
  managerId?: string,
): Promise<{ projectId: string; created: boolean }> {
  return apiFetch<{ projectId: string; created: boolean }>(
    `/leads/project-inquiries/${id}/convert`,
    {
      method: 'POST',
      body: JSON.stringify(managerId ? { managerId } : {}),
    },
  );
}
export function listPortalProjectInquiries(): Promise<ProjectInquirySummary[]> {
  return apiFetch<ProjectInquirySummary[]>('/portal/project-inquiries');
}
export function listUnlinkedProjectInquiries(): Promise<ProjectInquirySummary[]> {
  return apiFetch<ProjectInquirySummary[]>('/portal/project-inquiries/unlinked');
}
export function linkProjectInquiry(id: string): Promise<{ status: 'ACCOUNT_CREATED' }> {
  return apiFetch<{ status: 'ACCOUNT_CREATED' }>(`/portal/project-inquiries/${id}/link`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
export function approveProjectInquiryProposal(id: string): Promise<ProjectInquirySummary> {
  return apiFetch<ProjectInquirySummary>(`/portal/project-inquiries/${id}/approve-proposal`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
export const PROJECT_INQUIRY_STATUS_LABELS: Record<ProjectInquiryStatus, string> = {
  PENDING_VERIFICATION: 'Email verification pending',
  EMAIL_VERIFIED: 'Email verified',
  ACCOUNT_CREATED: 'Account created',
  UNDER_REVIEW: 'Under review',
  PROPOSAL_SENT: 'Proposal sent',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  CONVERTED: 'Project created',
};

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

export function listClientsPage(params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<{ data: AdminClient[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set('search', params.search);
  return apiFetchPaged<AdminClient[]>(`/clients?${query.toString()}`);
}

/** Client pickers require the complete option set; every server request stays bounded. */
export async function listClients(): Promise<AdminClient[]> {
  const pageSize = 100;
  const first = await listClientsPage({ page: 1, pageSize });
  const rows = [...first.data];
  for (let page = 2; page <= Math.ceil(first.meta.total / pageSize); page += 1) {
    const next = await listClientsPage({ page, pageSize });
    rows.push(...next.data);
  }
  return rows;
}
export function createClient(input: CreateClientInput): Promise<AdminClient> {
  return apiFetch<AdminClient>('/clients', { method: 'POST', body: JSON.stringify(input) });
}
export function getClientProfile(id: string): Promise<ClientProfile> {
  return apiFetch<ClientProfile>(`/clients/${id}`);
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
export function getPortalProject(id: string): Promise<ProjectWorkspace> {
  return apiFetch<ProjectWorkspace>(`/portal/projects/${id}`);
}
export function listPortalMilestones(): Promise<AdminMilestone[]> {
  return apiFetch<AdminMilestone[]>('/portal/milestones');
}
export interface PortalDocument {
  id: string;
  title: string;
  category: string | null;
  format: 'MARKDOWN' | 'RICH_TEXT' | 'FILE';
  content: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  updatedAt: string;
}
export function listPortalDocuments(projectId: string): Promise<PortalDocument[]> {
  return apiFetch<PortalDocument[]>(`/portal/projects/${projectId}/documents`);
}
export function downloadPortalDocument(projectId: string, document: PortalDocument): Promise<void> {
  return apiDownload(
    `/portal/projects/${projectId}/documents/${document.id}/file`,
    document.fileName ?? document.title,
  );
}

export function listEmployees() {
  return apiFetch<import('@somwave/shared').AdminEmployee[]>('/employees');
}
export function listEmployeeCandidates() {
  return apiFetch<{ id: string; name: string; email: string }[]>('/employees/candidates');
}
export function createEmployee(input: import('@somwave/shared').CreateEmployeeInput) {
  return apiFetch<import('@somwave/shared').AdminEmployee>('/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export function listAttendance() {
  return apiFetch<import('@somwave/shared').AdminAttendance[]>('/attendance');
}
export function checkIn(employeeId: string) {
  return apiFetch('/attendance/check-in', { method: 'POST', body: JSON.stringify({ employeeId }) });
}
export function checkOut(employeeId: string) {
  return apiFetch('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({ employeeId }),
  });
}
export function listLeave() {
  return apiFetch<import('@somwave/shared').AdminLeaveRequest[]>('/leave-requests');
}
export function createLeave(input: import('@somwave/shared').CreateLeaveRequestInput) {
  return apiFetch('/leave-requests', { method: 'POST', body: JSON.stringify(input) });
}
export function updateLeave(id: string, input: import('@somwave/shared').UpdateLeaveRequestInput) {
  return apiFetch(`/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export function listDocuments(params: { page: number; pageSize: number; search?: string }) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set('search', params.search);
  return apiFetchPaged<import('@somwave/shared').AdminDocument[]>(`/documents?${query.toString()}`);
}
export function createDocument(input: import('@somwave/shared').CreateDocumentInput) {
  return apiFetch('/documents', { method: 'POST', body: JSON.stringify(input) });
}
export function deleteDocument(id: string) {
  return apiFetch<{ ok: boolean }>(`/documents/${id}`, { method: 'DELETE' });
}
export function downloadDocument(id: string, fileName: string) {
  return apiDownload(`/documents/${id}/file`, fileName);
}
export function listMedia() {
  return apiFetch<import('@somwave/shared').AdminMediaAsset[]>('/media');
}
export function createMedia(input: import('@somwave/shared').CreateMediaAssetInput) {
  return apiFetch('/media', { method: 'POST', body: JSON.stringify(input) });
}
export function deleteMedia(id: string) {
  return apiFetch<{ ok: boolean }>(`/media/${id}`, { method: 'DELETE' });
}
export function downloadMedia(id: string, fileName: string) {
  return apiDownload(`/media/${id}/file`, fileName);
}
export function listAuditLogs() {
  return apiFetch<import('@somwave/shared').AdminAuditLog[]>('/audit-logs');
}
export function listNotifications() {
  return apiFetch<import('@somwave/shared').AdminNotification[]>('/notifications');
}
export function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}/read`, { method: 'POST' });
}
