// Create / edit a team member in the CMS (W5.2). The shared schema drives the
// resolver (§11). Writes invalidate the public team cache server-side.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTeamMemberSchema,
  type AdminTeamMember,
  type CreateTeamMemberInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateTeamMember, useUpdateTeamMember } from '../hooks';

export interface TeamMemberFormModalProps {
  open: boolean;
  onClose: () => void;
  member?: AdminTeamMember | null; // present → edit
}

const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function TeamMemberFormModal({
  open,
  onClose,
  member,
}: TeamMemberFormModalProps): ReactNode {
  const isEdit = Boolean(member);
  const createMutation = useCreateTeamMember();
  const updateMutation = useUpdateTeamMember();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamMemberInput>({
    resolver: zodResolver(createTeamMemberSchema),
    defaultValues: {
      name: member?.name ?? '',
      role: member?.role ?? '',
      bio: member?.bio ?? undefined,
      photoUrl: member?.photoUrl ?? undefined,
      linkedinUrl: member?.linkedinUrl ?? undefined,
      order: member?.order ?? 0,
      isPublished: member?.isPublished ?? true,
    },
  });

  const close = (): void => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      name: values.name,
      role: values.role,
      bio: orUndefined(values.bio),
      photoUrl: orUndefined(values.photoUrl),
      linkedinUrl: orUndefined(values.linkedinUrl),
      order: values.order,
      isPublished: values.isPublished,
    };
    try {
      if (isEdit && member) {
        await updateMutation.mutateAsync({
          id: member.id,
          input: {
            ...payload,
            bio: payload.bio ?? null,
            photoUrl: payload.photoUrl ?? null,
            linkedinUrl: payload.linkedinUrl ?? null,
          },
        });
      } else {
        await createMutation.mutateAsync(payload);
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
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel xubinta' : 'Xubin cusub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Magaca" error={errors.name?.message} {...register('name')} />
        <Input label="Jagada" error={errors.role?.message} {...register('role')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Taariikh-nololeed</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={3}
            {...register('bio')}
          />
        </label>

        <Input
          label="Sawirka (link, ikhtiyaari)"
          placeholder="https://"
          error={errors.photoUrl?.message}
          {...register('photoUrl')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="LinkedIn (ikhtiyaari)"
            placeholder="https://"
            error={errors.linkedinUrl?.message}
            {...register('linkedinUrl')}
          />
          <Input
            label="Kala horreyn (order)"
            type="number"
            min={0}
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />
        </div>

        <label className="flex items-center gap-2 text-base text-ink">
          <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
          La daabaco (published)
        </label>

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
