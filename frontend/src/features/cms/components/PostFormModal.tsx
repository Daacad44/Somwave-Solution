// Create / edit a blog post in the CMS (W4.2). The shared schema drives the
// resolver (§11). Writes invalidate the public blog cache server-side.
import { type ReactNode, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  articleImageFileError,
  createPostSchema,
  type AdminPost,
  type AdminCategory,
  type CreatePostInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { ApiError } from '../../../lib/apiClient';
import { uploadArticleImage } from '../api';
import { useCreatePost, useUpdatePost } from '../hooks';
import { ArticleImageField } from './ArticleImageField';

export interface PostFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: AdminCategory[];
  post?: AdminPost | null; // present → edit
}

const orUndefined = (value: string | undefined): string | undefined =>
  value && value.trim() !== '' ? value.trim() : undefined;

function fieldErrors(details: unknown): string | null {
  if (!details || typeof details !== 'object' || !('fieldErrors' in details)) return null;
  const fields = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
  if (!fields) return null;
  const lines = Object.entries(fields).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => `${field}: ${message}`),
  );
  return lines.length > 0 ? lines.join(' ') : null;
}

function articleErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (err.code === 'FORBIDDEN') return 'You do not have permission to create articles.';
  if (err.code === 'NOT_FOUND') return 'The article could not be found.';
  if (err.code === 'CONFLICT') return err.message || 'An article with this slug already exists.';
  if (err.code === 'VALIDATION_ERROR') {
    return fieldErrors(err.details) ?? err.message ?? 'The article data is not valid.';
  }
  if (err.code === 'INTERNAL_ERROR') {
    return 'The server could not save the article. Please try again.';
  }
  return err.message;
}

function uploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.message === 'Upload canceled.') return err.message;
  if (!(err instanceof ApiError)) return 'The image could not be uploaded. Please try again.';
  if (err.code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (err.code === 'FORBIDDEN') return 'You do not have permission to upload images.';
  if (err.code === 'VALIDATION_ERROR') return err.message || 'Please upload a valid image.';
  if (err.message === 'Network error') return 'The network connection was lost. Please try again.';
  // Storage failures carry an actionable server message (not configured, rejected keys, timeout).
  if (err.code === 'SERVICE_UNAVAILABLE' && err.message) return err.message;
  if (err.message?.includes('File storage')) return 'Image storage is unavailable.';
  return 'The image could not be uploaded. Please try again.';
}

export function PostFormModal({ open, onClose, categories, post }: PostFormModalProps): ReactNode {
  const isEdit = Boolean(post);
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const { toast } = useToast();
  const uploadAbort = useRef<AbortController | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
      authorName: post?.authorName ?? '',
      categoryId: post?.categoryId ?? undefined,
      isPublished: post?.isPublished ?? false,
    },
  });

  const close = (): void => {
    uploadAbort.current?.abort();
    reset();
    setServerError(null);
    setImageFile(null);
    setImageRemoved(false);
    setImageError(null);
    setUploading(false);
    setUploadProgress(null);
    onClose();
  };

  const onSelectImage = (file: File): void => {
    const message = articleImageFileError({ name: file.name, type: file.type, size: file.size });
    if (message) {
      setImageFile(null);
      setImageError(message);
      return;
    }
    setImageError(null);
    setImageRemoved(false);
    setImageFile(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (imageError) {
      setServerError(imageError);
      return;
    }
    const controller = new AbortController();
    uploadAbort.current = controller;
    let phase: 'upload' | 'save' = 'save';
    try {
      let coverImage: string | null | undefined;
      if (imageFile) {
        phase = 'upload';
        setUploading(true);
        setUploadProgress(0);
        const uploaded = await uploadArticleImage(
          imageFile,
          (percent) => setUploadProgress(percent),
          controller.signal,
          'articles',
        );
        coverImage = uploaded.url;
        phase = 'save';
      } else if (imageRemoved) {
        coverImage = null;
      } else if (isEdit) {
        coverImage = post?.coverImage ?? null;
      }

      if (isEdit && post) {
        await updateMutation.mutateAsync({
          id: post.id,
          input: {
            slug: values.slug,
            title: values.title,
            excerpt: values.excerpt,
            body: values.body,
            coverImage,
            authorName: orUndefined(values.authorName) ?? null,
            categoryId: orUndefined(values.categoryId) ?? null,
            isPublished: values.isPublished,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          ...(coverImage ? { coverImage } : {}),
          authorName: orUndefined(values.authorName),
          categoryId: orUndefined(values.categoryId),
        });
      }
      uploadAbort.current = null;
      toast(
        imageFile ? 'Image uploaded successfully.' : isEdit ? 'Article saved.' : 'Article created.',
        'success',
      );
      close();
    } catch (err) {
      if (err instanceof ApiError && err.message === 'Upload canceled.') return;
      setUploading(false);
      setUploadProgress(null);
      setServerError(phase === 'upload' ? uploadErrorMessage(err) : articleErrorMessage(err));
    }
  });

  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit article' : 'New article'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Title" error={errors.title?.message} {...register('title')} />
        <Input
          label="Slug (URL)"
          placeholder="how-to-choose-a-company"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Input label="Excerpt" error={errors.excerpt?.message} {...register('excerpt')} />
        <Input
          label="Author (optional)"
          error={errors.authorName?.message}
          {...register('authorName')}
        />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Body</span>
          <textarea
            className="min-h-40 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={8}
            {...register('body')}
          />
          {errors.body ? <span className="text-sm text-error">{errors.body.message}</span> : null}
        </label>

        <ArticleImageField
          existingUrl={post?.coverImage}
          file={imageFile}
          removed={imageRemoved}
          error={imageError}
          uploading={uploading}
          progress={uploadProgress}
          onSelect={onSelectImage}
          onRemove={() => {
            setImageFile(null);
            setImageRemoved(true);
            setImageError(null);
          }}
        />

        <div className="flex items-end gap-4">
          <Select
            label="Category"
            className="flex-1"
            options={[
              { value: '', label: 'No category' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            {...register('categoryId')}
          />
          <label className="mb-2 flex items-center gap-2 text-base text-ink">
            <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
            Published
          </label>
        </div>

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
