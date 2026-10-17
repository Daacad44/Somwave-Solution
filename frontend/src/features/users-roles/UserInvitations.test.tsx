// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserFormModal } from './components/UserFormModal';
import { UsersPage } from './UsersPage';
import { createUser, listUsers, listRoles, listInvitations, invitationAction } from './api';
vi.mock('./api', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  listUsers: vi.fn(),
  listRoles: vi.fn(),
  listInvitations: vi.fn(),
  invitationAction: vi.fn(),
}));
vi.mock('../../lib/rbac', () => ({ useHasPermission: () => true }));
const role = { id: 'role-engineer', name: 'ENGINEER', description: null, isSystem: true };
const invitation = {
  id: 'invite',
  name: 'Ayaan Ali',
  email: 'ayaan@example.com',
  roleIds: [role.id],
  status: 'PENDING',
  expiresAt: '2026-12-01T00:00:00Z',
  createdAt: '2026-10-17T00:00:00Z',
};
function page(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {node}
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRoles).mockResolvedValue([role]);
  vi.mocked(listUsers).mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  vi.mocked(listInvitations).mockResolvedValue([invitation]);
});
describe('User invitation administration', () => {
  it('sends name, email and selected roles without a password', async () => {
    vi.mocked(createUser).mockResolvedValue(invitation);
    const onClose = vi.fn();
    page(<UserFormModal open onClose={onClose} roles={[role]} />);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ayaan Ali' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ayaan@example.com' } });
    fireEvent.click(screen.getByLabelText('ENGINEER'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        name: 'Ayaan Ali',
        email: 'ayaan@example.com',
        roleIds: [role.id],
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
  it('renders backend delivery failures and keeps invitation form open', async () => {
    vi.mocked(createUser).mockRejectedValue(new Error('Delivery failed'));
    const close = vi.fn();
    page(<UserFormModal open onClose={close} roles={[role]} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ayaan Ali' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ayaan@example.com' } });
    fireEvent.click(screen.getByLabelText('ENGINEER'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
    await screen.findByText('Something went wrong. Please try again.');
    expect(close).not.toHaveBeenCalled();
  });
  it('lists invitation status and supports resend and cancellation', async () => {
    vi.mocked(invitationAction).mockResolvedValue(invitation);
    page(<UsersPage />);
    await screen.findByText('ayaan@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Resend invitation' }));
    await waitFor(() => expect(invitationAction).toHaveBeenCalledWith('invite', 'resend'));
    await screen.findByText(/Previous links are no longer valid/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invitation' }));
    await waitFor(() => expect(invitationAction).toHaveBeenCalledWith('invite', 'cancel'));
    fireEvent.change(screen.getByLabelText('Invitation status'), { target: { value: 'EXPIRED' } });
    await screen.findByText('No invitations');
    expect(screen.queryByText('ayaan@example.com')).not.toBeInTheDocument();
  });
});
