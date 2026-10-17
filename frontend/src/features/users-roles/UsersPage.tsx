// Users management screen (I1). Table with search + pagination, the four
// data-states (§12), role assignment, and permission-gated actions (§13).
import { type FormEvent, type ReactNode, useState } from 'react';
import type { AdminUser } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import {
  useUsers,
  useRoles,
  useDeactivateUser,
  useInvitations,
  useInvitationAction,
} from './hooks';
import { UserFormModal } from './components/UserFormModal';

const PAGE_SIZE = 20;

export function UsersPage(): ReactNode {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const canCreate = useHasPermission(PERMISSIONS.USERS_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.USERS_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.USERS_DELETE);

  const usersQuery = useUsers({ page, pageSize: PAGE_SIZE, search: search || undefined });
  const rolesQuery = useRoles();
  const deactivate = useDeactivateUser();
  const invitations = useInvitations();
  const invitationMutation = useInvitationAction();
  const [invitationFilter, setInvitationFilter] = useState('ALL');
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState<AdminUser | null>(null);
  const runInvitation = async (id: string, action: 'resend' | 'cancel') => {
    setNotice('');
    try {
      await invitationMutation.mutateAsync({ id, action });
      setNotice(
        action === 'resend'
          ? 'Invitation sent. Previous links are no longer valid.'
          : 'Invitation cancelled.',
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update invitation.');
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirming, setConfirming] = useState<AdminUser | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (user: AdminUser): void => {
    setEditing(user);
    setFormOpen(true);
  };

  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const total = usersQuery.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const users = usersQuery.data?.data ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Users</h1>
          <p className="mt-1 text-base text-muted">Manage user accounts and roles.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>New user</Button> : null}
      </div>

      {notice ? (
        <p role="status" className="mt-3 text-sm text-ink">
          {notice}
        </p>
      ) : null}
      <form onSubmit={submitSearch} className="mt-6 flex max-w-md gap-2">
        <Input
          placeholder="Search name or email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search users"
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {usersQuery.isLoading ? (
          <LoadingState rows={6} label="Loading" />
        ) : usersQuery.isError ? (
          <ErrorState description="Could not load users." onRetry={() => usersQuery.refetch()} />
        ) : users.length === 0 ? (
          <EmptyState
            title="No users yet"
            description={search ? 'No results match your search.' : undefined}
            action={canCreate ? <Button onClick={openCreate}>New user</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Roles</Th>
                <Th>Status</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td className="font-medium">{user.name}</Td>
                  <Td className="text-muted">{user.email}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} tone="info">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={user.isActive ? 'success' : 'neutral'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDetails(user)}>
                        Details
                      </Button>
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(user)}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete && user.isActive ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(user)}>
                          Suspend
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} / {totalPages} · {total} user
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <section className="mt-10" aria-labelledby="invitations-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="invitations-heading" className="text-xl font-semibold text-ink">
            User invitations
          </h2>
          <label className="text-sm">
            Invitation status{' '}
            <select
              className="ml-2 rounded border border-border bg-surface p-2"
              value={invitationFilter}
              onChange={(e) => setInvitationFilter(e.target.value)}
            >
              {['ALL', 'PENDING', 'EXPIRED', 'CANCELLED', 'ACCEPTED'].map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
          {invitations.isLoading ? (
            <LoadingState rows={3} />
          ) : invitations.isError ? (
            <ErrorState
              description="Could not load invitations."
              onRetry={() => invitations.refetch()}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Name / email</Th>
                  <Th>Roles</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  <Th>Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {(invitations.data ?? [])
                  .filter((item) => invitationFilter === 'ALL' || item.status === invitationFilter)
                  .map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <span className="font-medium">{item.name}</span>
                        <br />
                        {item.email}
                      </Td>
                      <Td>
                        {item.roleIds
                          .map((id) => rolesQuery.data?.find((role) => role.id === id)?.name ?? id)
                          .join(', ')}
                      </Td>
                      <Td>
                        <Badge tone={item.status === 'ACCEPTED' ? 'success' : 'neutral'}>
                          {item.status}
                        </Badge>
                      </Td>
                      <Td>{new Date(item.expiresAt).toLocaleString()}</Td>
                      <Td>
                        <div className="flex gap-2">
                          {canCreate && (item.status === 'PENDING' || item.status === 'EXPIRED') ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={invitationMutation.isPending}
                              onClick={() => void runInvitation(item.id, 'resend')}
                            >
                              Resend invitation
                            </Button>
                          ) : null}
                          {canCreate && (item.status === 'PENDING' || item.status === 'EXPIRED') ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={invitationMutation.isPending}
                              onClick={() => void runInvitation(item.id, 'cancel')}
                            >
                              Cancel invitation
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  ))}
              </TBody>
            </Table>
          )}
          {!invitations.isLoading &&
          !invitations.isError &&
          !(invitations.data ?? []).some(
            (item) => invitationFilter === 'ALL' || item.status === invitationFilter,
          ) ? (
            <EmptyState title="No invitations" />
          ) : null}
        </div>
      </section>
      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title="User details">
        <dl className="space-y-3 text-sm">
          <div>
            <dt>Name</dt>
            <dd>{details?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{details?.email}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{details?.roles.join(', ')}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{details?.isActive ? 'Active' : 'Suspended'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{details ? new Date(details.createdAt).toLocaleString() : ''}</dd>
          </div>
        </dl>
      </Modal>
      {formOpen ? (
        <UserFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          roles={rolesQuery.data ?? []}
          user={editing}
          onSaved={(invited) =>
            setNotice(
              invited
                ? 'Invitation sent. The user will create their own password after verifying their email.'
                : 'User updated.',
            )
          }
        />
      ) : null}

      <Modal open={Boolean(confirming)} onClose={() => setConfirming(null)} title="Deactivate user">
        <p className="text-base text-ink">
          Are you sure you want to deactivate <strong>{confirming?.name}</strong>? Their sessions
          will end immediately.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={deactivate.isPending}
            onClick={async () => {
              if (!confirming) return;
              try {
                await deactivate.mutateAsync(confirming.id);
                setConfirming(null);
                setNotice('User suspended. Their sessions have ended.');
              } catch (error) {
                setNotice(error instanceof Error ? error.message : 'Could not suspend user.');
                setConfirming(null);
              }
            }}
          >
            Yes, deactivate
          </Button>
        </div>
      </Modal>
    </section>
  );
}
