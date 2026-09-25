import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS, type AuthUser } from '@somwave/shared';
import { hasPermission } from '../../lib/rbac';
import { listInvoices, listLeads, listPortalProjects, listTickets } from '../ops/api';
import { listProjects } from '../projects/api';
import { listTasks } from '../tasks/api';

const STALE_TIME = 30_000;

export function useDashboard(user: AuthUser | null | undefined) {
  const projectsEnabled = hasPermission(user, PERMISSIONS.PROJECTS_READ);
  const tasksEnabled = hasPermission(user, PERMISSIONS.TASKS_READ);
  const leadsEnabled = hasPermission(user, PERMISSIONS.LEADS_READ);
  const invoicesEnabled = hasPermission(user, PERMISSIONS.INVOICES_READ);
  const ticketsEnabled = hasPermission(user, PERMISSIONS.TICKETS_READ);
  const portalProjectsEnabled =
    hasPermission(user, PERMISSIONS.PORTAL_READ) && !projectsEnabled && Boolean(user?.clientId);

  const projects = useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: () => listProjects({ page: 1, pageSize: 5 }),
    enabled: projectsEnabled,
    staleTime: STALE_TIME,
  });
  const activeProjects = useQuery({
    queryKey: ['dashboard', 'projects', 'active'],
    queryFn: () => listProjects({ page: 1, pageSize: 1, status: 'ACTIVE' }),
    enabled: projectsEnabled,
    staleTime: STALE_TIME,
  });
  const tasks = useQuery({
    queryKey: ['dashboard', 'tasks'],
    queryFn: () => listTasks({ page: 1, pageSize: 5 }),
    enabled: tasksEnabled,
    staleTime: STALE_TIME,
  });
  const doneTasks = useQuery({
    queryKey: ['dashboard', 'tasks', 'done'],
    queryFn: () => listTasks({ page: 1, pageSize: 1, status: 'DONE' }),
    enabled: tasksEnabled,
    staleTime: STALE_TIME,
  });
  const leads = useQuery({
    queryKey: ['dashboard', 'leads'],
    queryFn: listLeads,
    enabled: leadsEnabled,
    staleTime: STALE_TIME,
  });
  const invoices = useQuery({
    queryKey: ['dashboard', 'invoices'],
    queryFn: listInvoices,
    enabled: invoicesEnabled,
    staleTime: STALE_TIME,
  });
  const tickets = useQuery({
    queryKey: ['dashboard', 'tickets'],
    queryFn: listTickets,
    enabled: ticketsEnabled,
    staleTime: STALE_TIME,
  });
  const portalProjects = useQuery({
    queryKey: ['dashboard', 'portal-projects'],
    queryFn: listPortalProjects,
    enabled: portalProjectsEnabled,
    staleTime: STALE_TIME,
  });

  const refetchMetrics = (): void => {
    if (projectsEnabled) {
      void projects.refetch();
      void activeProjects.refetch();
    }
    if (tasksEnabled) {
      void tasks.refetch();
      void doneTasks.refetch();
    }
    if (leadsEnabled) void leads.refetch();
    if (invoicesEnabled) void invoices.refetch();
    if (ticketsEnabled) void tickets.refetch();
    if (portalProjectsEnabled) void portalProjects.refetch();
  };

  return {
    projectsEnabled,
    tasksEnabled,
    leadsEnabled,
    invoicesEnabled,
    ticketsEnabled,
    portalProjectsEnabled,
    projects,
    activeProjects,
    tasks,
    doneTasks,
    leads,
    invoices,
    tickets,
    portalProjects,
    refetchMetrics,
  };
}
