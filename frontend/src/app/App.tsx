import { type ReactNode, lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { AppShell } from './layout/AppShell';
import { useCurrentUser } from '../features/auth/hooks';
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

// Placeholder authenticated landing. Real feature routes (lazy) mount under the
// AppShell as they land (SYSTEM_PROMPT §6, §16).
function Dashboard(): ReactNode {
  const { data: user } = useCurrentUser();
  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Welcome, {user?.name}</h1>
      <p className="mt-1 text-base text-muted">Your workspace is ready.</p>
    </section>
  );
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/users"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <UsersPage />
              </Suspense>
            }
          />
          <Route
            path="/roles"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <RolesPage />
              </Suspense>
            }
          />
          <Route
            path="/projects"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <ProjectsPage />
              </Suspense>
            }
          />
          <Route
            path="/tasks"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <TasksPage />
              </Suspense>
            }
          />
          <Route
            path="/milestones"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <MilestonesPage />
              </Suspense>
            }
          />
          <Route
            path="/cms/services"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <ServicesAdminPage />
              </Suspense>
            }
          />
          <Route
            path="/cms/posts"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <PostsAdminPage />
              </Suspense>
            }
          />
          <Route
            path="/cms/portfolio"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <PortfolioAdminPage />
              </Suspense>
            }
          />
          <Route
            path="/cms/careers"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <CareersAdminPage />
              </Suspense>
            }
          />
          <Route
            path="/cms/testimonials"
            element={
              <Suspense fallback={<LoadingState rows={6} />}>
                <TestimonialsAdminPage />
              </Suspense>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
