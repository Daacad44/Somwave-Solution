import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateInquiryInput,
  UpdateJobApplicationInput,
  CreateClientInput,
  CreateTimesheetInput,
  UpdateTimesheetInput,
  CreateInvoiceInput,
  RecordPaymentInput,
  ChargeEvcPaymentInput,
  CreateTicketInput,
  UpdateTicketInput,
  CreateTicketReplyInput,
} from '@somwave/shared';
import {
  listLeads,
  updateLead,
  listApplications,
  updateApplication,
  listClients,
  createClient,
  listTimesheets,
  createTimesheet,
  updateTimesheet,
  listInvoices,
  getInvoice,
  createInvoice,
  sendInvoice,
  voidInvoice,
  recordPayment,
  chargeEvcPayment,
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  listTicketAssignees,
  createTicketReply,
  listPortalProjects,
  listPortalMilestones,
} from './api';

export function useLeads() {
  return useQuery({ queryKey: ['leads'], queryFn: listLeads });
}
export function useUpdateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInquiryInput }) => updateLead(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useApplications() {
  return useQuery({ queryKey: ['applications'], queryFn: listApplications });
}
export function useUpdateApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJobApplicationInput }) =>
      updateApplication(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['applications'] }),
  });
}

export function useClients(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['clients'],
    queryFn: listClients,
    enabled: options?.enabled ?? true,
  });
}
export function useCreateClient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => createClient(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useTimesheets() {
  return useQuery({ queryKey: ['timesheets'], queryFn: listTimesheets });
}
export function useCreateTimesheet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTimesheetInput) => createTimesheet(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['timesheets'] }),
  });
}
export function useUpdateTimesheet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTimesheetInput }) =>
      updateTimesheet(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['timesheets'] }),
  });
}

export function useInvoices() {
  return useQuery({ queryKey: ['invoices'], queryFn: listInvoices });
}
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => getInvoice(id as string),
    enabled: Boolean(id),
  });
}
export function useCreateInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => createInvoice(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
export function useSendInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      sendInvoice(id, idempotencyKey),
    onSuccess: (_data, { id }) => {
      void client.invalidateQueries({ queryKey: ['invoices'] });
      void client.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}
export function useVoidInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voidInvoice(id),
    onSuccess: (_data, id) => {
      void client.invalidateQueries({ queryKey: ['invoices'] });
      void client.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}
export function useRecordPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: RecordPaymentInput;
      idempotencyKey: string;
    }) => recordPayment(input, idempotencyKey),
    onSuccess: (_data, { input }) => {
      void client.invalidateQueries({ queryKey: ['invoices'] });
      void client.invalidateQueries({ queryKey: ['invoices', input.invoiceId] });
    },
  });
}

export function useChargeEvcPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: ChargeEvcPaymentInput;
      idempotencyKey: string;
    }) => chargeEvcPayment(input, idempotencyKey),
    onSuccess: (_data, { input }) => {
      void client.invalidateQueries({ queryKey: ['invoices'] });
      void client.invalidateQueries({ queryKey: ['invoices', input.invoiceId] });
    },
  });
}

export function useTickets() {
  return useQuery({ queryKey: ['tickets'], queryFn: listTickets });
}
export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicket(id as string),
    enabled: Boolean(id),
  });
}
export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicket(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['tickets'] }),
  });
}
export function useUpdateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTicketInput }) =>
      updateTicket(id, input),
    onSuccess: (_data, { id }) => {
      void client.invalidateQueries({ queryKey: ['tickets'] });
      void client.invalidateQueries({ queryKey: ['tickets', id] });
    },
  });
}
export function useTicketAssignees(enabled: boolean) {
  return useQuery({
    queryKey: ['ticket-assignees'],
    queryFn: listTicketAssignees,
    enabled,
  });
}
export function useCreateTicketReply() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTicketReplyInput }) =>
      createTicketReply(id, input),
    onSuccess: (_data, { id }) => {
      void client.invalidateQueries({ queryKey: ['tickets', id] });
    },
  });
}

export function usePortalProjects() {
  return useQuery({ queryKey: ['portal-projects'], queryFn: listPortalProjects });
}
export function usePortalMilestones() {
  return useQuery({ queryKey: ['portal-milestones'], queryFn: listPortalMilestones });
}
