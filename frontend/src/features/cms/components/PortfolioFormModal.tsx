// Create / edit a portfolio item in the CMS (W4.3). The shared schema drives the
// resolver (§11). Writes invalidate the public portfolio cache server-side.
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPortfolioItemSchema,
  articleImageFileError,
  type AdminPortfolioItem,
  type CreatePortfolioItemInput,
} from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useCreatePortfolio, useUpdatePortfolio } from '../hooks';
import { uploadArticleImage } from '../api';
import { ArticleImageField } from './ArticleImageField';

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
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
      category: item?.category ?? undefined,
      coverImage: item?.coverImage ?? undefined,
      technologies: item?.technologies ?? [],
      galleryImages: item?.galleryImages ?? [],
      features: item?.features ?? [],
      completionDate: item?.completionDate ?? null,
      projectStatus: item?.projectStatus ?? null,
      liveDemoUrl: item?.liveDemoUrl ?? null,
      caseStudyUrl: item?.caseStudyUrl ?? null,
      featured: item?.featured ?? false,
      isArchived: item?.isArchived ?? false,
      seoTitle: item?.seoTitle ?? null,
      seoDescription: item?.seoDescription ?? null,
      order: item?.order ?? 0,
      isPublished: item?.isPublished ?? false,
    },
  });

  const close = (): void => {
    reset();
    setServerError(null);
    setCoverFile(null);
    setGalleryFiles([]);
    setCoverRemoved(false);
    setUploadError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (uploadError) throw new Error(uploadError);
      setUploading(true);
      const uploadedCover = coverFile ? (await uploadArticleImage(coverFile)).url : null;
      const uploadedGallery = await Promise.all(
        galleryFiles.map(async (file) => (await uploadArticleImage(file)).url),
      );
      const coverImage = uploadedCover ?? (coverRemoved ? null : orUndefined(values.coverImage));
      const galleryImages = [...(values.galleryImages ?? []), ...uploadedGallery];
      if (galleryImages.length > 20) throw new Error('The gallery supports up to 20 images.');
      const fields = {
        technologies: values.technologies,
        galleryImages,
        features: values.features,
        completionDate: values.completionDate || null,
        projectStatus: orUndefined(values.projectStatus ?? undefined) ?? null,
        liveDemoUrl: orUndefined(values.liveDemoUrl ?? undefined) ?? null,
        caseStudyUrl: orUndefined(values.caseStudyUrl ?? undefined) ?? null,
        featured: values.featured,
        isArchived: values.isArchived,
        seoTitle: orUndefined(values.seoTitle ?? undefined) ?? null,
        seoDescription: orUndefined(values.seoDescription ?? undefined) ?? null,
      };
      if (isEdit && item) {
        await updateMutation.mutateAsync({
          id: item.id,
          input: {
            slug: values.slug,
            title: values.title,
            summary: values.summary,
            description: orUndefined(values.description) ?? null,
            client: orUndefined(values.client) ?? null,
            category: values.category || null,
            coverImage,
            ...fields,
            order: values.order,
            isPublished: values.isPublished,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          description: orUndefined(values.description),
          client: orUndefined(values.client),
          category: values.category || undefined,
          coverImage: coverImage ?? undefined,
          ...fields,
        });
      }
      close();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  });

  const pending = isSubmitting || uploading || createMutation.isPending || updateMutation.isPending;
  const preview = watch();

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Edit portfolio item' : 'New portfolio item'}
      wide
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Title" error={errors.title?.message} {...register('title')} />
        <Input
          label="Slug (URL)"
          placeholder="nidaamka-maamulka-iskuulka"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Input label="Summary" error={errors.summary?.message} {...register('summary')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Description</span>
          <textarea
            className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={4}
            {...register('description')}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="technologies"
            render={({ field }) => (
              <ListField
                label="Technologies (one per line)"
                value={field.value ?? []}
                onChange={field.onChange}
                error={errors.technologies?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="features"
            render={({ field }) => (
              <ListField
                label="Project features (one per line)"
                value={field.value ?? []}
                onChange={field.onChange}
                error={errors.features?.message}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Client (only with publication permission)"
            error={errors.client?.message}
            {...register('client')}
          />
          <Input
            label="Display order"
            type="number"
            min={0}
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Category
          <select
            className="h-11 rounded-md border border-border bg-surface px-3 text-base text-ink"
            {...register('category', { setValueAs: (value: string) => value || undefined })}
          >
            <option value="">Select a category</option>
            <option value="WEBSITE">Websites</option>
            <option value="MOBILE_APP">Mobile Apps</option>
            <option value="CUSTOM_SOFTWARE">Custom Software</option>
          </select>
        </label>

        <ArticleImageField
          label="Project cover image"
          existingUrl={item?.coverImage}
          file={coverFile}
          removed={coverRemoved}
          uploading={uploading}
          error={uploadError}
          onSelect={(file) => {
            const message = articleImageFileError({
              name: file.name,
              type: file.type,
              size: file.size,
            });
            setUploadError(message);
            if (!message) {
              setCoverFile(file);
              setCoverRemoved(false);
            }
          }}
          onRemove={() => {
            setCoverFile(null);
            setCoverRemoved(true);
          }}
        />
        <Input
          label="Or cover image URL"
          placeholder="https://"
          error={errors.coverImage?.message}
          {...register('coverImage', { setValueAs: (value: string) => value || undefined })}
        />
        <Controller
          control={control}
          name="galleryImages"
          render={({ field }) => (
            <ListField
              label="Gallery image URLs (one per line, up to 20)"
              value={field.value ?? []}
              onChange={field.onChange}
              error={errors.galleryImages?.message}
            />
          )}
        />
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Add gallery images (PNG, JPG or WEBP; max 5 MB each)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="rounded-md border border-border p-2 text-sm"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const error = files
                .map((file) =>
                  articleImageFileError({ name: file.name, type: file.type, size: file.size }),
                )
                .find(Boolean);
              setUploadError(error ?? null);
              if (!error) setGalleryFiles(files);
            }}
          />
          {galleryFiles.length > 0 ? (
            <span className="text-muted">{galleryFiles.length} new image(s) selected</span>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Completion date"
            type="date"
            error={errors.completionDate?.message}
            {...register('completionDate', { setValueAs: (value: string) => value || null })}
          />
          <Input
            label="Project status"
            placeholder="e.g. Delivered"
            error={errors.projectStatus?.message}
            {...register('projectStatus', { setValueAs: (value: string) => value || null })}
          />
          <Input
            label="Live demo URL"
            placeholder="https://"
            error={errors.liveDemoUrl?.message}
            {...register('liveDemoUrl', { setValueAs: (value: string) => value || null })}
          />
          <Input
            label="Case study URL"
            placeholder="https://"
            error={errors.caseStudyUrl?.message}
            {...register('caseStudyUrl', { setValueAs: (value: string) => value || null })}
          />
          <Input
            label="SEO title"
            error={errors.seoTitle?.message}
            {...register('seoTitle', { setValueAs: (value: string) => value || null })}
          />
          <Input
            label="SEO description"
            error={errors.seoDescription?.message}
            {...register('seoDescription', { setValueAs: (value: string) => value || null })}
          />
        </div>

        <label className="flex items-center gap-2 text-base text-ink">
          <input type="checkbox" className="size-4 accent-primary" {...register('featured')} />{' '}
          Featured on homepage
        </label>
        <label className="flex items-center gap-2 text-base text-ink">
          <input type="checkbox" className="size-4 accent-primary" {...register('isArchived')} />{' '}
          Archived
        </label>

        <label className="flex items-center gap-2 text-base text-ink">
          <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
          Published
        </label>

        <details className="rounded-lg border border-border bg-surface-alt p-4">
          <summary className="cursor-pointer text-sm font-bold text-brand">
            Preview current draft
          </summary>
          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {preview.category?.replaceAll('_', ' ') || 'Project'}
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">{preview.title || 'Project title'}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {preview.summary || 'A short project summary will appear here.'}
            </p>
            {preview.technologies?.length ? (
              <p className="mt-3 text-xs text-muted">{preview.technologies.join(' · ')}</p>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted">
            This preview is visible only to you until you publish.
          </p>
        </details>

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

function ListField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}): ReactNode {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <textarea
        className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        rows={4}
        value={value.join('\n')}
        onChange={(event) =>
          onChange(
            event.target.value
              .split('\n')
              .map((entry) => entry.trim())
              .filter(Boolean),
          )
        }
      />
      {error ? <span className="text-sm text-error">{error}</span> : null}
    </label>
  );
}
