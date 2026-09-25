// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AuthUser } from '@somwave/shared';
import { PERMISSIONS, ROLES } from '@somwave/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('1024px'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

vi.mock('../../features/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
  useLogout: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import { useCurrentUser } from '../../features/auth/hooks';
import { AppShell } from './AppShell';

const mockedUseCurrentUser = vi.mocked(useCurrentUser);

function renderShell(user: AuthUser): void {
  mockedUseCurrentUser.mockReturnValue({
    data: user,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useCurrentUser>);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  it('does not expose a standalone Security sidebar item', () => {
    renderShell({
      id: 'u1',
      email: 'a@b.com',
      name: 'Super Admin',
      roles: [ROLES.SUPER_ADMIN],
      permissions: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.CONTENT_READ],
      clientId: null,
      twoFactorEnabled: false,
      twoFactorRequired: true,
    });
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Security' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
  });
});
