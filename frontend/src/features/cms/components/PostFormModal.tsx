// Create / edit a blog post in the CMS (W4.2). The shared schema drives the
// resolver (§11). Writes invalidate the public blog cache server-side.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPostSchema,
  type AdminPost,
  type AdminCategory,
  type CreatePostInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreatePost, useUpdatePost } from '../hooks';

export interface PostFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: AdminCategory[];
  post?: AdminPost | null; // present → edit
}

const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

export function PostFormModal({ open, onClose, categories, post }: PostFormModalProps): ReactNode {
  const isEdit = Boolean(post);
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      slug: post?.slug ?? '',
      title: post?.title ?? '',
      excerpt: post?.excerpt ?? '',
      body: post?.body ?? '',
      coverImage: post?.coverImage ?? undefined,
      categoryId: post?.categoryId ?? undefined,
      isPublished: post?.isPublished ?? false,
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
      if (isEdit && post) {
        await updateMutation.mutateAsync({
          id: post.id,
          input: {
            slug: values.slug,
            title: values.title,
            excerpt: values.excerpt,
            body: values.body,
            coverImage: orUndefined(values.coverImage) ?? null,
            categoryId: orUndefined(values.categoryId) ?? null,
            isPublished: values.isPublished,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          coverImage: orUndefined(values.coverImage),
          categoryId: orUndefined(values.categoryId),
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
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel maqaalka' : 'Maqaal cusub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Cinwaanka" error={errors.title?.message} {...register('title')} />
        <Input
          label="Slug (URL)"
          placeholder="sida-loo-doorto-shirkad"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Input label="Kooban" error={errors.excerpt?.message} {...register('excerpt')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Qoraalka</span>
          <textarea
            className="min-h-40 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={8}
            {...register('body')}
          />
          {errors.body ? <span className="text-sm text-error">{errors.body.message}</span> : null}
        </label>

        <Input
          label="Sawirka (link, ikhtiyaari)"
          placeholder="https://"
          error={errors.coverImage?.message}
          {...register('coverImage')}
        />

        <div className="flex items-end gap-4">
          <Select
            label="Qaybta"
            className="flex-1"
            options={[
              { value: '', label: 'Qayb la’aan' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            {...register('categoryId')}
          />
          <label className="mb-2 flex items-center gap-2 text-base text-ink">
            <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
            La daabaco
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
