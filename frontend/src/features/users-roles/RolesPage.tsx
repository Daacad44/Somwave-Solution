// Roles & permissions screen (I1.2). Lists the fixed roles and lets an admin with
// roles.manage edit each role's permission set (§13). Read-only otherwise.
import { type ReactNode, useState } from 'react';
import type { AdminRole } from '@somwave/shared';
import { PERMISSIONS } from '@somwave/shared';
import { Table, THead, TBody, Tr, Th, Td } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useRoles } from './hooks';
import { RolePermissionsModal } from './components/RolePermissionsModal';

export function RolesPage(): ReactNode {
  const rolesQuery = useRoles();
  const canManage = useHasPermission(PERMISSIONS.ROLES_MANAGE);
  const [editing, setEditing] = useState<AdminRole | null>(null);

  const roles = rolesQuery.data ?? [];

  return (
    <section>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Roles &amp; permissions</h1>
        <p className="mt-1 text-base text-muted">Manage permissions for each system role.</p>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface">
        {rolesQuery.isLoading ? (
          <LoadingState rows={5} label="Loading" />
        ) : rolesQuery.isError ? (
          <ErrorState description="Could not load roles." onRetry={() => rolesQuery.refetch()} />
        ) : roles.length === 0 ? (
          <EmptyState title="No roles yet" />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Role</Th>
                <Th>Type</Th>
                <Th className="text-end">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {roles.map((role) => (
                <Tr key={role.id}>
                  <Td className="font-medium">{role.name}</Td>
                  <Td>
                    <Badge tone={role.isSystem ? 'info' : 'neutral'}>
                      {role.isSystem ? 'Nidaam' : 'Gaar'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(role)}>
                        {canManage ? 'Manage permissions' : 'View permissions'}
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {editing ? (
        <RolePermissionsModal
          key={editing.id}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          role={editing}
          canManage={canManage}
        />
      ) : null}
    </section>
  );
}
