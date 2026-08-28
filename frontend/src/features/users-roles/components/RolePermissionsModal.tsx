// Edit the permissions assigned to a role (I1.2). SUPER_ADMIN is shown locked —
// it always holds the full set and the server refuses to change it (§13).
import { type ReactNode, useMemo, useState } from 'react';
import type { AdminRole, Permission } from '@somwave/shared';
import { ROLES } from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { LoadingState, ErrorState } from '../../../components/states';
import { ApiError } from '../../../lib/apiClient';
import { useRole, usePermissions, useSetRolePermissions } from '../hooks';

export interface RolePermissionsModalProps {
  open: boolean;
  onClose: () => void;
  role: AdminRole;
  canManage: boolean;
}

// Group the flat `resource.action` vocabulary by its resource prefix (§5).
function groupByResource(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const resource = permission.key.split('.')[0] ?? 'other';
    (groups[resource] ??= []).push(permission);
    return groups;
  }, {});
}

export function RolePermissionsModal({
  open,
  onClose,
  role,
  canManage,
}: RolePermissionsModalProps): ReactNode {
  const isSuperAdmin = role.name === ROLES.SUPER_ADMIN;
  const editable = canManage && !isSuperAdmin;
  const roleQuery = useRole(open ? role.id : null);
  const permsQuery = usePermissions();
  const save = useSetRolePermissions();

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Seed the selection once the role's current permissions arrive.
  const current = roleQuery.data?.permissions;
  const working = selected ?? new Set(current ?? []);

  const grouped = useMemo(() => groupByResource(permsQuery.data ?? []), [permsQuery.data]);

  const toggle = (key: string): void => {
    const next = new Set(working);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const close = (): void => {
    setSelected(null);
    setServerError(null);
    onClose();
  };

  const onSave = async (): Promise<void> => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: role.id, permissionKeys: [...working] });
      close();
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Wax baa qaldamay. Fadlan mar kale isku day.',
      );
    }
  };

  const loading = roleQuery.isLoading || permsQuery.isLoading;
  const failed = roleQuery.isError || permsQuery.isError;

  return (
    <Modal open={open} onClose={close} title={`Rukhsadaha — ${role.name}`}>
      {isSuperAdmin ? (
        <p className="text-base text-muted">
          SUPER_ADMIN wuxuu had iyo jeer haystaa dhammaan rukhsadaha, lamana beddeli karo.
        </p>
      ) : loading ? (
        <LoadingState rows={5} label="Waa la soo rarayaa" />
      ) : failed ? (
        <ErrorState
          description="Rukhsadaha lama soo rari karin."
          onRetry={() => roleQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="max-h-80 overflow-y-auto pe-1">
            {Object.entries(grouped).map(([resource, perms]) => (
              <fieldset key={resource} className="mb-3">
                <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
                  {resource}
                </legend>
                <div className="flex flex-col gap-1">
                  {perms.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-center gap-2 text-base text-ink"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={working.has(permission.key)}
                        disabled={!editable}
                        onChange={() => toggle(permission.key)}
                      />
                      <span>{permission.key}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              {editable ? 'Jooji' : 'Xir'}
            </Button>
            {editable ? (
              <Button isLoading={save.isPending} onClick={onSave}>
                Kaydi
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
