// Create / edit a user with role assignment (I1). The shared schema drives the
// resolver, so client and server agree on validity (§11).
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createUserSchema,
  type AdminUser,
  type AdminRole,
  type CreateUserInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateUser, useUpdateUser } from '../hooks';

export interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  roles: AdminRole[];
  user?: AdminUser | null; // present → edit, absent → create
}

export function UserFormModal({ open, onClose, roles, user }: UserFormModalProps): ReactNode {
  const isEdit = Boolean(user);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: user?.email ?? '', name: user?.name ?? '', password: '', roleIds: [] },
  });

  // Roles are assigned by name in the AdminUser shape; map to ids for editing.
  const initialRoleIds = roles.filter((r) => user?.roles.includes(r.name)).map((r) => r.id);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialRoleIds);
  const [isActive, setIsActive] = useState<boolean>(user?.isActive ?? true);
  const [serverError, setServerError] = useState<string | null>(null);

  const toggleRole = (id: string): void => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const close = (): void => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (isEdit && user) {
        await updateMutation.mutateAsync({
          id: user.id,
          input: { name: values.name, isActive, roleIds: selectedRoleIds },
        });
      } else {
        await createMutation.mutateAsync({ ...values, roleIds: selectedRoleIds });
      }
      close();
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Wax baa qaldamay. Fadlan mar kale isku day.',
      );
    }
  });

  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Wax ka beddel isticmaalaha' : 'Isticmaale cusub'}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Iimayl"
          type="email"
          autoComplete="off"
          disabled={isEdit}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input label="Magaca" error={errors.name?.message} {...register('name')} />
        {!isEdit ? (
          <Input
            label="Furaha sirta"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">Doorarka</legend>
          {roles.length === 0 ? (
            <p className="text-sm text-muted">Wali door lama helin.</p>
          ) : (
            roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-base text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                />
                {role.name}
              </label>
            ))
          )}
        </fieldset>

        {isEdit ? (
          <label className="flex items-center gap-2 text-base text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Firfircoon (active)
          </label>
        ) : null}

        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Jooji
          </Button>
          <Button type="submit" isLoading={pending}>
            {isEdit ? 'Kaydi' : 'Abuur'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
