// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { apiFetch } from '../../lib/apiClient';
import { EngineerActivationPage } from './EngineerActivationPage';

vi.mock('../../lib/apiClient', () => ({ apiFetch: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function renderPage(path = '/activate-engineer?token=valid-invitation-token') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <EngineerActivationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EngineerActivationPage', () => {
  it('waits for explicit verification and uses the returned single-use activation token', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        activationToken: 'secure-activation-token',
        name: 'Ayaan Ali',
        email: 'ayaan@example.com',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        existingAccount: false,
        profile: null,
      })
      .mockResolvedValueOnce({ ok: true });
    renderPage();
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await screen.findByText(/Email verified/);
    fireEvent.change(screen.getByRole('textbox', { name: 'Job title' }), {
      target: { value: 'Software Engineer' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Engineering specialization' }), {
      target: { value: 'Backend Engineer' },
    });
    fireEvent.change(screen.getByLabelText('Create password'), {
      target: { value: 'Mosaic!7River8' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Mosaic!7River8' },
    });
    expect(screen.getByText('Password strength: Strong')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/auth/engineer-invitations/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'valid-invitation-token' }),
      }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/auth/engineer-invitations/activate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('secure-activation-token'),
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Your engineer account is active');
  });

  it('shows password requirements and blocks a mismatch before calling the API', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      activationToken: 'secure-activation-token',
      name: 'Ayaan Ali',
      email: 'ayaan@example.com',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      existingAccount: false,
      profile: null,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await screen.findByText('Password requirements');
    expect(screen.getByText(/Use 12 to 128 characters/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Create password'), {
      target: { value: 'Mosaic!7River8' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different' },
    });
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('allows an existing account to use its current legacy password', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        activationToken: 'secure-activation-token',
        name: 'Ayaan Ali',
        email: 'ayaan@example.com',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        existingAccount: true,
        profile: {
          jobTitle: 'Engineer',
          specialization: 'Backend',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
        },
      })
      .mockResolvedValueOnce({ ok: true });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await screen.findByLabelText('Current password');
    expect(screen.queryByText('Password requirements')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/auth/engineer-invitations/activate',
      expect.objectContaining({ body: expect.not.stringContaining('confirmPassword') }),
    );
  });

  it('requests a replacement link without revealing whether an address has an account', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true });
    renderPage('/activate-engineer');
    fireEvent.click(
      screen.getByRole('button', { name: 'Invitation link expired or unavailable?' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Invited email address' }), {
      target: { value: 'ayaan@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request a new link' }));
    await screen.findByText(/If an invitation is available/);
    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/engineer-invitations/resend',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ayaan@example.com' }),
      }),
    );
  });
});
