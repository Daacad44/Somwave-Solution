// Create / edit a milestone (I2.3). The shared schema drives the resolver (§11).
// The project is chosen on create and fixed thereafter.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMilestoneSchema,
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  type AdminMilestone,
  type CreateMilestoneInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateMilestone, useUpdateMilestone } from '../hooks';

export interface MilestoneFormModalProps {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string }[];
  milestone?: AdminMilestone | null; // present → edit
}

const statusOptions = MILESTONE_STATUSES.map((value) => ({
  value,
  label: MILESTONE_STATUS_LABELS[value],
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
    formState: { errors, isSubmitting },
  } = useForm<CreateMilestoneInput>({
    resolver: zodResolver(createMilestoneSchema),
    defaultValues: {
      projectId: milestone?.project.id ?? projects[0]?.id ?? '',
      title: milestone?.title ?? '',
      description: milestone?.description ?? '',
      status: milestone?.status ?? 'PENDING',
      dueDate: dateValue(milestone?.dueDate) || undefined,
      order: milestone?.order ?? 0,
    },
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
            dueDate: orUndefined(values.dueDate) ?? null,
            order: values.order,
          },
        });
      } else {
        await createMutation.mutateAsync({
          projectId: values.projectId,
          title: values.title,
          status: values.status,
          order: values.order,
          description: orUndefined(values.description),
          dueDate: orUndefined(values.dueDate),
        });
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
      title={isEdit ? 'Wax ka beddel marxaladda' : 'Marxalad cusub'}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Select
          label="Mashruuca"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder={projects.length === 0 ? 'Wali mashruuc ma jiro' : undefined}
          disabled={isEdit}
          error={errors.projectId?.message}
          {...register('projectId')}
        />
        <Input label="Cinwaanka" error={errors.title?.message} {...register('title')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Sharaxaad</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={3}
            {...register('description')}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Xaalada" options={statusOptions} {...register('status')} />
          <Input
            label="Taariikhda dhammaadka"
            type="date"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />
        </div>

        <Input
          label="Kala horreyn (order)"
          type="number"
          min={0}
          error={errors.order?.message}
          {...register('order', { valueAsNumber: true })}
        />

        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Jooji
          </Button>
          <Button type="submit" isLoading={pending} disabled={!isEdit && projects.length === 0}>
            {isEdit ? 'Kaydi' : 'Abuur'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
