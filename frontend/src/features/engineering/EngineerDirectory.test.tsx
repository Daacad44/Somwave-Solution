// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./accountsApi', () => ({
  accountsApi: {
    list: vi.fn(),
    overview: vi.fn(),
    emailReadiness: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('./api', () => ({ engineeringApi: { projects: vi.fn() } }));

import { accountsApi } from './accountsApi';
import { engineeringApi } from './api';
import { EngineerDirectory } from './EngineerDirectory';

function renderDirectory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EngineerDirectory />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accountsApi.list).mockResolvedValue([]);
  vi.mocked(accountsApi.overview).mockResolvedValue({
    totalEngineers: 0,
    activeEngineers: 0,
    pendingInvitations: 0,
    pendingProjectAcceptances: 0,
    availableEngineers: 0,
    engineersAtCapacity: 0,
    totalAssignedProjects: 0,
    activeEngineeringTasks: 0,
    overdueTasks: 0,
    projectsAtRisk: 0,
  });
  vi.mocked(engineeringApi.projects).mockResolvedValue([]);
});

describe('engineer registration email status', () => {
  it('shows missing backend Resend settings and blocks submission', async () => {
    vi.mocked(accountsApi.emailReadiness).mockResolvedValue({
      provider: 'resend',
      configured: false,
      missing: ['EMAIL_FROM', 'APP_PUBLIC_URL'],
    });
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: 'Register engineer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('EMAIL_FROM, APP_PUBLIC_URL');
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
    expect(accountsApi.emailReadiness).toHaveBeenCalledOnce();
  });

  it('identifies Resend as configured without claiming mailbox delivery', async () => {
    vi.mocked(accountsApi.emailReadiness).mockResolvedValue({
      provider: 'resend',
      configured: true,
      missing: [],
    });
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: 'Register engineer' }));
    expect(await screen.findByText(/Resend settings are present/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeEnabled();
    expect(screen.getByText(/mailbox delivery may take longer/)).toBeVisible();
  });
});
