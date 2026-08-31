// Create / edit a job opening in the CMS (W4.4). The shared schema drives the
// resolver (§11). Writes invalidate the public careers cache server-side.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createJobOpeningSchema,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  type AdminJobOpening,
  type CreateJobOpeningInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateOpening, useUpdateOpening } from '../hooks';

export interface JobOpeningFormModalProps {
  open: boolean;
  onClose: () => void;
  opening?: AdminJobOpening | null; // present → edit
}

const typeOptions = EMPLOYMENT_TYPES.map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABELS[value],
}));

export function JobOpeningFormModal({
  open,
  onClose,
  opening,
}: JobOpeningFormModalProps): ReactNode {
  const isEdit = Boolean(opening);
  const createMutation = useCreateOpening();
  const updateMutation = useUpdateOpening();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobOpeningInput>({
    resolver: zodResolver(createJobOpeningSchema),
    defaultValues: {
      slug: opening?.slug ?? '',
      title: opening?.title ?? '',
      location: opening?.location ?? '',
      employmentType: opening?.employmentType ?? 'FULL_TIME',
      summary: opening?.summary ?? '',
      description: opening?.description ?? '',
      isPublished: opening?.isPublished ?? true,
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
      if (isEdit && opening) {
        await updateMutation.mutateAsync({ id: opening.id, input: values });
      } else {
        await createMutation.mutateAsync(values);
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
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel fursadda' : 'Fursad cusub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Cinwaanka" error={errors.title?.message} {...register('title')} />
        <Input
          label="Slug (URL)"
          placeholder="horumariye-frontend"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Goobta" error={errors.location?.message} {...register('location')} />
          <Select
            label="Nooca shaqada"
            options={typeOptions}
            error={errors.employmentType?.message}
            {...register('employmentType')}
          />
        </div>
        <Input label="Kooban" error={errors.summary?.message} {...register('summary')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Faahfaahin</span>
          <textarea
            className="min-h-40 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={6}
            {...register('description')}
          />
          {errors.description ? (
            <span className="text-sm text-error">{errors.description.message}</span>
          ) : null}
        </label>

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
