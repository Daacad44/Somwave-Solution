import { type ReactNode, lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
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
const TimesheetsPage = lazy(() =>
  import('../features/ops/TimesheetsPage').then((m) => ({ default: m.TimesheetsPage })),
);
const InvoicesPage = lazy(() =>
  import('../features/ops/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
);
const TicketsPage = lazy(() =>
  import('../features/ops/TicketsPage').then((m) => ({ default: m.TicketsPage })),
);
const PortalProjectsPage = lazy(() =>
  import('../features/ops/PortalProjectsPage').then((m) => ({ default: m.PortalProjectsPage })),
);

function LazyPage({ children }: { children: ReactNode }): ReactNode {
  return <Suspense fallback={<LoadingState rows={6} />}>{children}</Suspense>;
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
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
              <LazyPage>
                <UsersPage />
              </LazyPage>
            }
          />
          <Route
            path="/roles"
            element={
              <LazyPage>
                <RolesPage />
              </LazyPage>
            }
          />
          <Route
            path="/projects"
            element={
              <LazyPage>
                <ProjectsPage />
              </LazyPage>
            }
          />
          <Route
            path="/tasks"
            element={
              <LazyPage>
                <TasksPage />
              </LazyPage>
            }
          />
          <Route
            path="/milestones"
            element={
              <LazyPage>
                <MilestonesPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/services"
            element={
              <LazyPage>
                <ServicesAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/posts"
            element={
              <LazyPage>
                <PostsAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/portfolio"
            element={
              <LazyPage>
                <PortfolioAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/careers"
            element={
              <LazyPage>
                <CareersAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/testimonials"
            element={
              <LazyPage>
                <TestimonialsAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/team"
            element={
              <LazyPage>
                <TeamAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/faqs"
            element={
              <LazyPage>
                <FaqAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/cms/subscribers"
            element={
              <LazyPage>
                <SubscribersAdminPage />
              </LazyPage>
            }
          />
          <Route
            path="/leads"
            element={
              <LazyPage>
                <LeadsPage />
              </LazyPage>
            }
          />
          <Route
            path="/applications"
            element={
              <LazyPage>
                <ApplicationsPage />
              </LazyPage>
            }
          />
          <Route
            path="/clients"
            element={
              <LazyPage>
                <ClientsPage />
              </LazyPage>
            }
          />
          <Route
            path="/timesheets"
            element={
              <LazyPage>
                <TimesheetsPage />
              </LazyPage>
            }
          />
          <Route
            path="/invoices"
            element={
              <LazyPage>
                <InvoicesPage />
              </LazyPage>
            }
          />
          <Route
            path="/tickets"
            element={
              <LazyPage>
                <TicketsPage />
              </LazyPage>
            }
          />
          <Route
            path="/portal/projects"
            element={
              <LazyPage>
                <PortalProjectsPage />
              </LazyPage>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
