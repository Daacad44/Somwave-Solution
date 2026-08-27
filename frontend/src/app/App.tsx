import { type ReactNode } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { useCurrentUser, useLogout } from '../features/auth/hooks';

// Placeholder authenticated landing. The real AppShell + lazy feature routes
// land in F0.4 (SYSTEM_PROMPT §6).
function Dashboard(): ReactNode {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  return (
    <main className="app-shell">
      <h1>Somwave</h1>
      <p>Signed in as {user?.name}.</p>
      <button type="button" onClick={onLogout} disabled={logout.isPending}>
        {logout.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </main>
  );
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
