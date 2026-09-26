import { type ReactNode, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS, type PermissionKey } from '@somwave/shared';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RequirePermission } from '../features/auth/RequirePermission';
import { AppShell } from './layout/AppShell';
import { LoadingState } from '../components/states';

// Feature routes are lazy (SYSTEM_PROMPT §4: React Router v6 lazy routes).
const UsersPage = lazy(() =>
  import('../features/users-roles/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import('../features/users-roles/RolesPage').then((m) => ({ default: m.RolesPage })),
);
const ProjectsPage = lazy(() =>
  import('../features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import('../features/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })),
);
const TasksPage = lazy(() =>
  import('../features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const MilestonesPage = lazy(() =>
  import('../features/milestones/MilestonesPage').then((m) => ({ default: m.MilestonesPage })),
);
const ServicesAdminPage = lazy(() =>
  import('../features/cms/ServicesAdminPage').then((m) => ({ default: m.ServicesAdminPage })),
);
const PostsAdminPage = lazy(() =>
  import('../features/cms/PostsAdminPage').then((m) => ({ default: m.PostsAdminPage })),
);
const PortfolioAdminPage = lazy(() =>
  import('../features/cms/PortfolioAdminPage').then((m) => ({ default: m.PortfolioAdminPage })),
);
const CareersAdminPage = lazy(() =>
  import('../features/cms/CareersAdminPage').then((m) => ({ default: m.CareersAdminPage })),
);
const TestimonialsAdminPage = lazy(() =>
  import('../features/cms/TestimonialsAdminPage').then((m) => ({
    default: m.TestimonialsAdminPage,
  })),
);
const TeamAdminPage = lazy(() =>
  import('../features/cms/TeamAdminPage').then((m) => ({ default: m.TeamAdminPage })),
);
const FaqAdminPage = lazy(() =>
  import('../features/cms/FaqAdminPage').then((m) => ({ default: m.FaqAdminPage })),
);
const SubscribersAdminPage = lazy(() =>
  import('../features/cms/SubscribersAdminPage').then((m) => ({
    default: m.SubscribersAdminPage,
  })),
);
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const LeadsPage = lazy(() =>
  import('../features/ops/LeadsPage').then((m) => ({ default: m.LeadsPage })),
);
const ApplicationsPage = lazy(() =>
  import('../features/ops/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })),
);
const ClientsPage = lazy(() =>
  import('../features/ops/ClientsPage').then((m) => ({ default: m.ClientsPage })),
);
const ClientDetailPage = lazy(() =>
  import('../features/ops/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })),
);
const TimesheetsPage = lazy(() =>
  import('../features/ops/TimesheetsPage').then((m) => ({ default: m.TimesheetsPage })),
);
const InvoicesPage = lazy(() =>
  import('../features/ops/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('../features/ops/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })),
);
const InvoicePrintPage = lazy(() =>
  import('../features/ops/InvoicePrintPage').then((m) => ({ default: m.InvoicePrintPage })),
);
const TicketsPage = lazy(() =>
  import('../features/ops/TicketsPage').then((m) => ({ default: m.TicketsPage })),
);
const TicketDetailPage = lazy(() =>
  import('../features/ops/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })),
);
const PortalProjectsPage = lazy(() =>
  import('../features/ops/PortalProjectsPage').then((m) => ({ default: m.PortalProjectsPage })),
);
const PortalProjectPage = lazy(() =>
  import('../features/ops/PortalProjectPage').then((m) => ({ default: m.PortalProjectPage })),
);
const PortalMilestonesPage = lazy(() =>
  import('../features/ops/PortalMilestonesPage').then((m) => ({
    default: m.PortalMilestonesPage,
  })),
);
const EmployeesPage = lazy(() =>
  import('../features/ops/EmployeesPage').then((m) => ({ default: m.EmployeesPage })),
);
const AttendancePage = lazy(() =>
  import('../features/ops/AttendancePage').then((m) => ({ default: m.AttendancePage })),
);
const LeavePage = lazy(() =>
  import('../features/ops/LeavePage').then((m) => ({ default: m.LeavePage })),
);
const DocumentsPage = lazy(() =>
  import('../features/ops/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const MediaPage = lazy(() =>
  import('../features/ops/MediaPage').then((m) => ({ default: m.MediaPage })),
);
const AuditPage = lazy(() =>
  import('../features/ops/AuditPage').then((m) => ({ default: m.AuditPage })),
);
const NotificationsPage = lazy(() =>
  import('../features/ops/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);

function LazyPage({ children }: { children: ReactNode }): ReactNode {
  return <Suspense fallback={<LoadingState rows={6} />}>{children}</Suspense>;
}

function Guarded({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}): ReactNode {
  return (
    <RequirePermission permission={permission}>
      <LazyPage>{children}</LazyPage>
    </RequirePermission>
  );
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/settings/2fa" element={<Navigate to="/profile?tab=security" replace />} />
          <Route
            path="/profile"
            element={
              <LazyPage>
                <ProfilePage />
              </LazyPage>
            }
          />
          <Route
            path="/"
            element={
              <LazyPage>
                <DashboardPage />
              </LazyPage>
            }
          />
          <Route
            path="/users"
            element={
              <Guarded permission={PERMISSIONS.USERS_READ}>
                <UsersPage />
              </Guarded>
            }
          />
          <Route
            path="/roles"
            element={
              <Guarded permission={PERMISSIONS.ROLES_READ}>
                <RolesPage />
              </Guarded>
            }
          />
          <Route
            path="/projects"
            element={
              <Guarded permission={PERMISSIONS.PROJECTS_READ}>
                <ProjectsPage />
              </Guarded>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <Guarded permission={PERMISSIONS.PROJECTS_READ}>
                <ProjectDetailPage />
              </Guarded>
            }
          />
          <Route
            path="/tasks"
            element={
              <Guarded permission={PERMISSIONS.TASKS_READ}>
                <TasksPage />
              </Guarded>
            }
          />
          <Route
            path="/milestones"
            element={
              <Guarded permission={PERMISSIONS.MILESTONES_READ}>
                <MilestonesPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/services"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <ServicesAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/posts"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <PostsAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/portfolio"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <PortfolioAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/careers"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <CareersAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/testimonials"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <TestimonialsAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/team"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <TeamAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/faqs"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <FaqAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/cms/subscribers"
            element={
              <Guarded permission={PERMISSIONS.CONTENT_READ}>
                <SubscribersAdminPage />
              </Guarded>
            }
          />
          <Route
            path="/leads"
            element={
              <Guarded permission={PERMISSIONS.LEADS_READ}>
                <LeadsPage />
              </Guarded>
            }
          />
          <Route
            path="/applications"
            element={
              <Guarded permission={PERMISSIONS.APPLICATIONS_READ}>
                <ApplicationsPage />
              </Guarded>
            }
          />
          <Route
            path="/clients"
            element={
              <Guarded permission={PERMISSIONS.CLIENTS_READ}>
                <ClientsPage />
              </Guarded>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <Guarded permission={PERMISSIONS.CLIENTS_READ}>
                <ClientDetailPage />
              </Guarded>
            }
          />
          <Route
            path="/timesheets"
            element={
              <Guarded permission={PERMISSIONS.TIMESHEETS_READ}>
                <TimesheetsPage />
              </Guarded>
            }
          />
          <Route
            path="/invoices"
            element={
              <Guarded permission={PERMISSIONS.INVOICES_READ}>
                <InvoicesPage />
              </Guarded>
            }
          />
          <Route
            path="/invoices/:id/print"
            element={
              <Guarded permission={PERMISSIONS.INVOICES_READ}>
                <InvoicePrintPage />
              </Guarded>
            }
          />
          <Route
            path="/invoices/:id"
            element={
              <Guarded permission={PERMISSIONS.INVOICES_READ}>
                <InvoiceDetailPage />
              </Guarded>
            }
          />
          <Route
            path="/tickets"
            element={
              <Guarded permission={PERMISSIONS.TICKETS_READ}>
                <TicketsPage />
              </Guarded>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <Guarded permission={PERMISSIONS.TICKETS_READ}>
                <TicketDetailPage />
              </Guarded>
            }
          />
          <Route
            path="/portal/projects"
            element={
              <Guarded permission={PERMISSIONS.PORTAL_READ}>
                <PortalProjectsPage />
              </Guarded>
            }
          />
          <Route
            path="/portal/projects/:id"
            element={
              <Guarded permission={PERMISSIONS.PORTAL_READ}>
                <PortalProjectPage />
              </Guarded>
            }
          />
          <Route
            path="/portal/milestones"
            element={
              <Guarded permission={PERMISSIONS.PORTAL_READ}>
                <PortalMilestonesPage />
              </Guarded>
            }
          />
          <Route
            path="/employees"
            element={
              <Guarded permission={PERMISSIONS.EMPLOYEES_READ}>
                <EmployeesPage />
              </Guarded>
            }
          />
          <Route
            path="/attendance"
            element={
              <Guarded permission={PERMISSIONS.ATTENDANCE_READ}>
                <AttendancePage />
              </Guarded>
            }
          />
          <Route
            path="/leave"
            element={
              <Guarded permission={PERMISSIONS.LEAVE_READ}>
                <LeavePage />
              </Guarded>
            }
          />
          <Route
            path="/documents"
            element={
              <Guarded permission={PERMISSIONS.DOCUMENTS_READ}>
                <DocumentsPage />
              </Guarded>
            }
          />
          <Route
            path="/media"
            element={
              <Guarded permission={PERMISSIONS.MEDIA_READ}>
                <MediaPage />
              </Guarded>
            }
          />
          <Route
            path="/audit"
            element={
              <Guarded permission={PERMISSIONS.AUDIT_READ}>
                <AuditPage />
              </Guarded>
            }
          />
          <Route
            path="/notifications"
            element={
              <Guarded permission={PERMISSIONS.NOTIFICATIONS_READ}>
                <NotificationsPage />
              </Guarded>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
