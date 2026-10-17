// Create / edit a testimonial in the CMS (W5.1). The shared schema drives the
// resolver (§11). Writes invalidate the public testimonials cache server-side.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTestimonialSchema,
  type AdminTestimonial,
  type CreateTestimonialInput,
} from '@somwave/shared';
import { articleImageFileError } from '@somwave/shared';
import { uploadArticleImage } from '../api';
import { ArticleImageField } from './ArticleImageField';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateTestimonial, useUpdateTestimonial } from '../hooks';

export interface TestimonialFormModalProps {
  open: boolean;
  onClose: () => void;
  testimonial?: AdminTestimonial | null; // present → edit
}

const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function TestimonialFormModal({
  open,
  onClose,
  testimonial,
}: TestimonialFormModalProps): ReactNode {
  const isEdit = Boolean(testimonial);
  const createMutation = useCreateTestimonial();
  const updateMutation = useUpdateTestimonial();
  const [serverError, setServerError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTestimonialInput>({
    resolver: zodResolver(createTestimonialSchema),
    defaultValues: {
      author: testimonial?.author ?? '',
      role: testimonial?.role ?? undefined,
      company: testimonial?.company ?? undefined,
      quote: testimonial?.quote ?? '',
      avatarUrl: testimonial?.avatarUrl ?? undefined,
      rating: testimonial?.rating ?? undefined,
      order: testimonial?.order ?? 0,
      isPublished: testimonial?.isPublished ?? true,
    },
  });

  const close = (): void => {
    reset();
    setServerError(null);
    setImageFile(null);
    setImageRemoved(false);
    setImageError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      author: values.author,
      quote: values.quote,
      role: orUndefined(values.role),
      company: orUndefined(values.company),
      avatarUrl: orUndefined(values.avatarUrl),
      rating: values.rating,
      order: values.order,
      isPublished: values.isPublished,
    };
    if (imageError) {
      setServerError(imageError);
      return;
    }
    try {
      if (imageFile) {
        payload.avatarUrl = (
          await uploadArticleImage(imageFile, setUploadProgress, undefined, 'testimonials')
        ).url;
      } else if (imageRemoved) payload.avatarUrl = undefined;
      if (isEdit && testimonial) {
        await updateMutation.mutateAsync({
          id: testimonial.id,
          input: {
            ...payload,
            role: payload.role ?? null,
            company: payload.company ?? null,
            avatarUrl: payload.avatarUrl ?? null,
            rating: payload.rating ?? null,
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
    <Modal open={open} onClose={close} title={isEdit ? 'Edit testimonial' : 'New testimonial'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Author" error={errors.author?.message} {...register('author')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Role" error={errors.role?.message} {...register('role')} />
          <Input label="Company" error={errors.company?.message} {...register('company')} />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Testimonial</span>
          <textarea
            className="min-h-28 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={4}
            {...register('quote')}
          />
          {errors.quote ? <span className="text-sm text-error">{errors.quote.message}</span> : null}
        </label>

        <ArticleImageField
          label="Image"
          existingUrl={testimonial?.avatarUrl}
          file={imageFile}
          removed={imageRemoved}
          error={imageError}
          uploading={isSubmitting}
          progress={uploadProgress}
          onSelect={(file) => {
            const error = articleImageFileError({
              name: file.name,
              type: file.type,
              size: file.size,
            });
            setImageError(error);
            if (!error) {
              setImageFile(file);
              setImageRemoved(false);
            }
          }}
          onRemove={() => {
            setImageFile(null);
            setImageRemoved(true);
            setImageError(null);
          }}
        />
        <Input
          label="Image URL (optional)"
          placeholder="https://"
          error={errors.avatarUrl?.message}
          {...register('avatarUrl', { setValueAs: orUndefined })}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Rating (1–5)"
            options={[
              { value: '', label: 'None' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '5', label: '5' },
            ]}
            error={errors.rating?.message}
            {...register('rating', {
              setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
            })}
          />
          <Input
            label="Display order"
            type="number"
            min={0}
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />
        </div>

        <label className="flex items-center gap-2 text-base text-ink">
          <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
          Published
        </label>

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
