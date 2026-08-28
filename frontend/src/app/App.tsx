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
        </Route>
      </Route>
    </Routes>
  );
}
