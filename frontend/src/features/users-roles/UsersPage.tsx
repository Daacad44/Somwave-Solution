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
import { useUsers, useRoles, useDeactivateUser } from './hooks';
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
          <h1 className="text-2xl font-semibold text-ink">Isticmaalayaasha</h1>
          <p className="mt-1 text-base text-muted">Maamul akoonnada iyo doorarkooda.</p>
        </div>
        {canCreate ? <Button onClick={openCreate}>Isticmaale cusub</Button> : null}
      </div>

      <form onSubmit={submitSearch} className="mt-6 flex max-w-md gap-2">
        <Input
          placeholder="Raadi magac ama iimayl…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Raadi isticmaalayaasha"
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          Raadi
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {usersQuery.isLoading ? (
          <LoadingState rows={6} label="Waa la soo rarayaa" />
        ) : usersQuery.isError ? (
          <ErrorState
            description="Isticmaalayaasha lama soo rari karin."
            onRetry={() => usersQuery.refetch()}
          />
        ) : users.length === 0 ? (
          <EmptyState
            title="Weli isticmaale ma jiro"
            description={search ? 'Raadintaadu waxba ma soo celin.' : undefined}
            action={canCreate ? <Button onClick={openCreate}>Isticmaale cusub</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Magaca</Th>
                <Th>Iimayl</Th>
                <Th>Doorar</Th>
                <Th>Xaalad</Th>
                <Th className="text-end">Ficil</Th>
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
                      {user.isActive ? 'Firfircoon' : 'Joojiyay'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(user)}>
                          Wax ka beddel
                        </Button>
                      ) : null}
                      {canDelete && user.isActive ? (
                        <Button size="sm" variant="danger" onClick={() => setConfirming(user)}>
                          Jooji
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
            Bogga {page} / {totalPages} · {total} isticmaale
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Hore
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Xiga
            </Button>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <UserFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          roles={rolesQuery.data ?? []}
          user={editing}
        />
      ) : null}

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Jooji isticmaalaha"
      >
        <p className="text-base text-ink">
          Ma hubtaa inaad joojinayso <strong>{confirming?.name}</strong>? Fadhigooda waa la joojin
          doonaa isla markiiba.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Maya
          </Button>
          <Button
            variant="danger"
            isLoading={deactivate.isPending}
            onClick={async () => {
              if (!confirming) return;
              await deactivate.mutateAsync(confirming.id);
              setConfirming(null);
            }}
          >
            Haa, jooji
          </Button>
        </div>
      </Modal>
    </section>
  );
}
