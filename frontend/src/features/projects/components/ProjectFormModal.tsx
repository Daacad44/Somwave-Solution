// Create / edit a project (I2.1). The shared schema drives the resolver (§11).
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProjectSchema,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type AdminProject,
  type CreateProjectInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateProject, useUpdateProject } from '../hooks';

export interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  project?: AdminProject | null; // present → edit
}

const statusOptions = PROJECT_STATUSES.map((value) => ({
  value,
  label: PROJECT_STATUS_LABELS[value],
}));

// A date input yields 'YYYY-MM-DD'; the ISO field portion for editing.
const dateValue = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');
const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function ProjectFormModal({ open, onClose, project }: ProjectFormModalProps): ReactNode {
  const isEdit = Boolean(project);
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'PLANNING',
      startDate: dateValue(project?.startDate) || undefined,
      dueDate: dateValue(project?.dueDate) || undefined,
      budget: project?.budget ?? undefined,
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
      status: values.status,
      description: orUndefined(values.description),
      startDate: orUndefined(values.startDate),
      dueDate: orUndefined(values.dueDate),
      budget: orUndefined(values.budget),
    };
    try {
      if (isEdit && project) {
        await updateMutation.mutateAsync({
          id: project.id,
          input: {
            ...payload,
            description: payload.description ?? null,
            startDate: payload.startDate ?? null,
            dueDate: payload.dueDate ?? null,
            budget: payload.budget ?? null,
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
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Wax ka beddel mashruuca' : 'Mashruuc cusub'}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Magaca" error={errors.name?.message} {...register('name')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Sharaxaad</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={3}
            {...register('description')}
          />
        </label>

        <Select
          label="Xaalada"
          options={statusOptions}
          error={errors.status?.message}
          {...register('status')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Taariikhda bilowga"
            type="date"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Input
            label="Taariikhda dhammaadka"
            type="date"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />
        </div>

        <Input
          label="Miisaaniyad (USD)"
          inputMode="decimal"
          placeholder="0.00"
          error={errors.budget?.message}
          {...register('budget')}
        />

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
