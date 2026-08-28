// Create / edit a website service in the CMS (W4). The shared schema drives the
// resolver (§11), so client and server agree on validity.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createServiceSchema, type AdminService, type CreateServiceInput } from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateService, useUpdateService } from '../hooks';

export interface ServiceFormModalProps {
  open: boolean;
  onClose: () => void;
  service?: AdminService | null; // present → edit
}

const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function ServiceFormModal({ open, onClose, service }: ServiceFormModalProps): ReactNode {
  const isEdit = Boolean(service);
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      slug: service?.slug ?? '',
      title: service?.title ?? '',
      summary: service?.summary ?? '',
      description: service?.description ?? '',
      order: service?.order ?? 0,
      isPublished: service?.isPublished ?? true,
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
      if (isEdit && service) {
        await updateMutation.mutateAsync({
          id: service.id,
          input: {
            slug: values.slug,
            title: values.title,
            summary: values.summary,
            description: orUndefined(values.description) ?? null,
            order: values.order,
            isPublished: values.isPublished,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: orUndefined(values.description),
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
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel adeegga' : 'Adeeg cusub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Cinwaanka" error={errors.title?.message} {...register('title')} />
        <Input
          label="Slug (URL)"
          placeholder="horumarinta-websaydka"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Input label="Kooban" error={errors.summary?.message} {...register('summary')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Sharaxaad</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={3}
            {...register('description')}
          />
        </label>

        <div className="flex items-end gap-4">
          <Input
            label="Kala horreyn (order)"
            type="number"
            min={0}
            className="w-32"
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />
          <label className="mb-2 flex items-center gap-2 text-base text-ink">
            <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
            La daabaco (published)
          </label>
        </div>

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
