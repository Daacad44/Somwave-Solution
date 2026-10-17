// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { apiFetch } from '../../lib/apiClient';
import { AccountActivationPage } from './AccountActivationPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('../../lib/apiClient', () => ({ apiFetch: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
function page(node: React.ReactNode, path = '/') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}
const strongPassword = 'Mosaic!7River8';
function passwords() {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: strongPassword } });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: strongPassword },
  });
}
describe('Secure invitation and reset screens', () => {
  it('requires explicit invitation verification and password confirmation before activation', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ name: 'Ayaan Ali', email: 'ayaan@example.com' })
      .mockResolvedValueOnce({ ok: true });
    page(<AccountActivationPage />, '/activate-account?token=invitation-secret');
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await screen.findByLabelText('New password');
    passwords();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'mismatch' } });
    fireEvent.submit(screen.getByLabelText('New password').closest('form')!);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: strongPassword },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    await screen.findByText(/Your account is active/);
    expect(apiFetch).toHaveBeenLastCalledWith(
      '/auth/user-invitations/activate',
      expect.objectContaining({
        body: JSON.stringify({ token: 'invitation-secret', password: strongPassword }),
      }),
    );
  });
  it('shows invalid invitation errors without offering password creation', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Invitation is expired or invalid.'));
    page(<AccountActivationPage />, '/activate-account?token=expired');
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('expired or invalid');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
  it('requires OTP verification before accepting a new password and uses the reset proof', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ token: 'reset-proof' })
      .mockResolvedValueOnce({ ok: true });
    page(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ayaan@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByLabelText('Verification code');
    expect(screen.getByRole('status')).toHaveTextContent('If an account exists');
    expect(screen.getByRole('button', { name: /Resend code in/ })).toBeDisabled();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await screen.findByLabelText('New password');
    passwords();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await screen.findByText(/previous sessions have ended/);
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/auth/password-reset/verify',
      expect.objectContaining({
        body: JSON.stringify({ email: 'ayaan@example.com', code: '123456' }),
      }),
    );
    expect(apiFetch).toHaveBeenLastCalledWith(
      '/auth/reset-password',
      expect.objectContaining({
        body: JSON.stringify({ token: 'reset-proof', password: strongPassword }),
      }),
    );
  });
  it('keeps the user at OTP verification when an invalid code is rejected', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('Code expired or invalid.'));
    page(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ayaan@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    await screen.findByLabelText('Verification code');
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Code expired or invalid.'),
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
