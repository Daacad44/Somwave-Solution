// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthUser } from '@somwave/shared';
import { ROLES } from '@somwave/shared';

vi.mock('./hooks', () => ({
  useCurrentUser: vi.fn(),
}));

import { useCurrentUser } from './hooks';
import { ProtectedRoute } from './ProtectedRoute';

const mockedUseCurrentUser = vi.mocked(useCurrentUser);

function user(partial: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'Admin',
    roles: [ROLES.ADMIN],
    permissions: [],
    clientId: null,
    twoFactorEnabled: false,
    twoFactorRequired: true,
    ...partial,
  };
}

describe('ProtectedRoute', () => {
  it('sends a privileged user without 2FA to Profile security', () => {
    mockedUseCurrentUser.mockReturnValue({
      data: user(),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCurrentUser>);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<p>Dashboard</p>} />
            <Route path="/profile" element={<p>Profile security</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Profile security')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('allows the profile route while 2FA is still required', () => {
    mockedUseCurrentUser.mockReturnValue({
      data: user(),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCurrentUser>);
    render(
      <MemoryRouter initialEntries={['/profile?tab=security']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<p>Enrol 2FA</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Enrol 2FA')).toBeInTheDocument();
  });
});
