// Create / edit a project (I2.1). The shared schema drives the resolver (§11).
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProjectSchema,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  PERMISSIONS,
  type AdminProject,
  type CreateProjectInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useHasPermission } from '../../../lib/rbac';
import { useCreateProject, useUpdateProject } from '../hooks';
import { INTERNAL_PROJECT_STATUS } from '../../../lib/internalLabels';

export interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  project?: AdminProject | null; // present → edit
}

const statusOptions = PROJECT_STATUSES.map((value) => ({
  value,
  label: INTERNAL_PROJECT_STATUS[value],
}));

// A date input yields 'YYYY-MM-DD'; the ISO field portion for editing.
const dateValue = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');
const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function ProjectFormModal({ open, onClose, project }: ProjectFormModalProps): ReactNode {
  const canEditBudget = useHasPermission(PERMISSIONS.INVOICES_UPDATE);
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
      priority: project?.priority ?? 'MEDIUM',
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
      priority: values.priority,
      description: orUndefined(values.description),
      startDate: orUndefined(values.startDate),
      dueDate: orUndefined(values.dueDate),
      ...(!isEdit && canEditBudget ? { budget: orUndefined(values.budget) } : {}),
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
          },
        });
      } else {
        await createMutation.mutateAsync(payload);
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
    <Modal open={open} onClose={close} title={isEdit ? 'Edit project' : 'New project'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Name" error={errors.name?.message} {...register('name')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Description</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={3}
            {...register('description')}
          />
        </label>

        <Select
          label="Status"
          options={statusOptions}
          error={errors.status?.message}
          {...register('status')}
        />
        <Select
          label="Priority"
          options={TASK_PRIORITIES.map((value) => ({
            value,
            label: value[0] + value.slice(1).toLowerCase(),
          }))}
          {...register('priority')}
        />

        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            label="Start date"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <DatePicker label="End date" error={errors.dueDate?.message} {...register('dueDate')} />
        </div>

        {!isEdit && canEditBudget ? (
          <Input
            label="Budget (USD)"
            inputMode="decimal"
            placeholder="0.00"
            error={errors.budget?.message}
            {...register('budget')}
          />
        ) : null}

        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" isLoading={pending}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
