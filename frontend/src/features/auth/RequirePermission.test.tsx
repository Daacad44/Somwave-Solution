// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuthUser } from '@somwave/shared';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { RequirePermission } from './RequirePermission';

vi.mock('./hooks', () => ({
  useCurrentUser: vi.fn(),
}));

import { useCurrentUser } from './hooks';

const mockedUseCurrentUser = vi.mocked(useCurrentUser);

function clientUser(): AuthUser {
  return {
    id: 'u1',
    email: 'client@example.com',
    name: 'Macmiil',
    roles: [ROLES.CLIENT],
    permissions: [PERMISSIONS.PORTAL_READ, PERMISSIONS.INVOICES_READ],
    clientId: 'cl_1',
    twoFactorEnabled: false,
    twoFactorRequired: false,
  };
}

describe('RequirePermission', () => {
  it('renders children when the user holds the permission', () => {
    mockedUseCurrentUser.mockReturnValue({
      data: clientUser(),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCurrentUser>);
    render(
      <RequirePermission permission={PERMISSIONS.INVOICES_READ}>
        <p>Invoice list</p>
      </RequirePermission>,
    );
    expect(screen.getByText('Invoice list')).toBeInTheDocument();
  });

  it('denies an internal page the client must not open', () => {
    mockedUseCurrentUser.mockReturnValue({
      data: clientUser(),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCurrentUser>);
    render(
      <RequirePermission permission={PERMISSIONS.PROJECTS_READ}>
        <p>Internal projects</p>
      </RequirePermission>,
    );
    expect(screen.queryByText('Internal projects')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
  });
});
