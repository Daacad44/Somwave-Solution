// Create / edit a portfolio item in the CMS (W4.3). The shared schema drives the
// resolver (§11). Writes invalidate the public portfolio cache server-side.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPortfolioItemSchema,
  type AdminPortfolioItem,
  type CreatePortfolioItemInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreatePortfolio, useUpdatePortfolio } from '../hooks';

export interface PortfolioFormModalProps {
  open: boolean;
  onClose: () => void;
  item?: AdminPortfolioItem | null; // present → edit
}

const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function PortfolioFormModal({ open, onClose, item }: PortfolioFormModalProps): ReactNode {
  const isEdit = Boolean(item);
  const createMutation = useCreatePortfolio();
  const updateMutation = useUpdatePortfolio();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePortfolioItemInput>({
    resolver: zodResolver(createPortfolioItemSchema),
    defaultValues: {
      slug: item?.slug ?? '',
      title: item?.title ?? '',
      summary: item?.summary ?? '',
      description: item?.description ?? '',
      client: item?.client ?? undefined,
      coverImage: item?.coverImage ?? undefined,
      order: item?.order ?? 0,
      isPublished: item?.isPublished ?? true,
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
      if (isEdit && item) {
        await updateMutation.mutateAsync({
          id: item.id,
          input: {
            slug: values.slug,
            title: values.title,
            summary: values.summary,
            description: orUndefined(values.description) ?? null,
            client: orUndefined(values.client) ?? null,
            coverImage: orUndefined(values.coverImage) ?? null,
            order: values.order,
            isPublished: values.isPublished,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: orUndefined(values.description),
          client: orUndefined(values.client),
          coverImage: orUndefined(values.coverImage),
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
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel shaqada' : 'Shaqo cusub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Cinwaanka" error={errors.title?.message} {...register('title')} />
        <Input
          label="Slug (URL)"
          placeholder="nidaamka-maamulka-iskuulka"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Input label="Kooban" error={errors.summary?.message} {...register('summary')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Sharaxaad</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={4}
            {...register('description')}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Macmiilka" error={errors.client?.message} {...register('client')} />
          <Input
            label="Kala horreyn (order)"
            type="number"
            min={0}
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />
        </div>

        <Input
          label="Sawirka (link, ikhtiyaari)"
          placeholder="https://"
          error={errors.coverImage?.message}
          {...register('coverImage')}
        />

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
