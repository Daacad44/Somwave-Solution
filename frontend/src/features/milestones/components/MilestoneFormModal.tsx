// Create / edit a milestone (I2.3). The shared schema drives the resolver (§11).
// The project is chosen on create and fixed thereafter.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMilestoneSchema,
  MILESTONE_STATUSES,
  type AdminMilestone,
  type CreateMilestoneInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateMilestone, useUpdateMilestone } from '../hooks';
import { INTERNAL_MILESTONE_STATUS } from '../../../lib/internalLabels';
import { engineeringApi } from '../../engineering/api';

export interface MilestoneFormModalProps {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string }[];
  milestone?: AdminMilestone | null; // present → edit
}

const statusOptions = MILESTONE_STATUSES.map((value) => ({
  value,
  label: INTERNAL_MILESTONE_STATUS[value],
}));

const dateValue = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');
const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function MilestoneFormModal({
  open,
  onClose,
  projects,
  milestone,
}: MilestoneFormModalProps): ReactNode {
  const isEdit = Boolean(milestone);
  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateMilestoneInput>({
    resolver: zodResolver(createMilestoneSchema),
    defaultValues: {
      projectId: milestone?.project.id ?? projects[0]?.id ?? '',
      title: milestone?.title ?? '',
      description: milestone?.description ?? '',
      status: milestone?.status ?? 'PENDING',
      clientVisible: milestone?.clientVisible ?? false,
      ownerId: milestone?.owner?.id ?? '',
      dueDate: dateValue(milestone?.dueDate) || undefined,
      order: milestone?.order ?? 0,
    },
  });
  const selectedProjectId = watch('projectId');
  const members = useQuery({
    queryKey: ['engineering-members', selectedProjectId],
    queryFn: () => engineeringApi.members(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const close = (): void => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (isEdit && milestone) {
        await updateMutation.mutateAsync({
          id: milestone.id,
          input: {
            title: values.title,
            description: orUndefined(values.description) ?? null,
            status: values.status,
            clientVisible: values.clientVisible,
            ownerId: values.ownerId || null,
            dueDate: orUndefined(values.dueDate) ?? null,
            order: values.order,
          },
        });
      } else {
        await createMutation.mutateAsync({
          projectId: values.projectId,
          title: values.title,
          status: values.status,
          clientVisible: values.clientVisible,
          ownerId: values.ownerId || null,
          order: values.order,
          description: orUndefined(values.description),
          dueDate: orUndefined(values.dueDate),
        });
      }
      close();
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    }
  });

  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit milestone' : 'New milestone'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Select
          label="Project"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder={projects.length === 0 ? 'No projects available yet' : undefined}
          disabled={isEdit}
          error={errors.projectId?.message}
          {...register('projectId')}
        />
        <Input label="Title" error={errors.title?.message} {...register('title')} />
        <Select
          label="Milestone owner"
          options={[
            { value: '', label: 'Unassigned' },
            ...(members.data ?? []).map((member) => ({
              value: member.user.id,
              label: member.user.name,
            })),
          ]}
          {...register('ownerId')}
        />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Description</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={3}
            {...register('description')}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" options={statusOptions} {...register('status')} />
          <Input
            label="End date"
            type="date"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />
        </div>

        <Input
          label="Display order"
          type="number"
          min={0}
          error={errors.order?.message}
          {...register('order', { valueAsNumber: true })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('clientVisible')} /> Share this milestone with the
          client
        </label>

        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={pending} disabled={!isEdit && projects.length === 0}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
