import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateInquiryInput,
  UpdateJobApplicationInput,
  CreateClientInput,
  CreateTimesheetInput,
  UpdateTimesheetInput,
  CreateInvoiceInput,
  CreateTicketInput,
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
  createInvoice,
  listTickets,
  createTicket,
  listPortalProjects,
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
export function useCreateInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => createInvoice(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useTickets() {
  return useQuery({ queryKey: ['tickets'], queryFn: listTickets });
}
export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicket(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function usePortalProjects() {
  return useQuery({ queryKey: ['portal-projects'], queryFn: listPortalProjects });
}
