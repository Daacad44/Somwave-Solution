// Create / edit a task (I2.2). The shared schema drives the resolver (§11). The
// project is chosen on create and fixed thereafter.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTaskSchema,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type AdminTask,
  type CreateTaskInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateTask, useUpdateTask } from '../hooks';

export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string }[];
  task?: AdminTask | null; // present → edit
}

const statusOptions = TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }));
const priorityOptions = TASK_PRIORITIES.map((value) => ({
  value,
  label: TASK_PRIORITY_LABELS[value],
}));

const dateValue = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');
const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function TaskFormModal({ open, onClose, projects, task }: TaskFormModalProps): ReactNode {
  const isEdit = Boolean(task);
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      projectId: task?.project.id ?? projects[0]?.id ?? '',
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'TODO',
      priority: task?.priority ?? 'MEDIUM',
      dueDate: dateValue(task?.dueDate) || undefined,
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
      if (isEdit && task) {
        await updateMutation.mutateAsync({
          id: task.id,
          input: {
            title: values.title,
            description: orUndefined(values.description) ?? null,
            status: values.status,
            priority: values.priority,
            dueDate: orUndefined(values.dueDate) ?? null,
          },
        });
      } else {
        await createMutation.mutateAsync({
          projectId: values.projectId,
          title: values.title,
          status: values.status,
          priority: values.priority,
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
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel hawsha' : 'Hawl cusub'}>
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
          <Select label="Mudnaanta" options={priorityOptions} {...register('priority')} />
        </div>

        <Input
          label="Taariikhda dhammaadka"
          type="date"
          error={errors.dueDate?.message}
          {...register('dueDate')}
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
