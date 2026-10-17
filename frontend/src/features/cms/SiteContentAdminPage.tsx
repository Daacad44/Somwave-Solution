import { type ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSIONS,
  ROLES,
  articleImageFileError,
  homeSectionIds,
  siteContentSchema,
  type SiteContent,
  type HomeSectionId,
  type TrustedBusinessId,
  type HeroSlideId,
} from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { useCurrentUser } from '../auth/hooks';
import {
  approveSiteContentDraft,
  getSiteContent,
  getSiteContentDraft,
  publishSiteContentDraft,
  saveSiteContent,
  submitSiteContentDraft,
  uploadArticleImage,
  type SiteContentDraft,
} from './api';

const QUERY_KEY = ['cms', 'site-content'] as const;
const logos: { id: TrustedBusinessId; name: string }[] = [
  { id: 'hormuud', name: 'Hormuud Telecom' },
  { id: 'somtel', name: 'Somtel' },
  { id: 'dahabshiil', name: 'Dahabshiil' },
  { id: 'taaj', name: 'TAAJ' },
  { id: 'premier-bank', name: 'Premier Bank' },
  { id: 'amal-bank', name: 'Amal Bank' },
];
const socialLabels = ['Facebook', 'Instagram', 'LinkedIn', 'X'] as const;
const fieldClass =
  'h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const areaClass =
  'min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

export function SiteContentAdminPage(): ReactNode {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: getSiteContent });
  const draftQuery = useQuery({ queryKey: [...QUERY_KEY, 'draft'], queryFn: getSiteContentDraft });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: saveSiteContent,
    onSuccess: (saved) => queryClient.setQueryData([...QUERY_KEY, 'draft'], saved),
  });
  const canEdit = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const { data: user } = useCurrentUser();
  const canPublish =
    canEdit &&
    Boolean(user?.roles.some((role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN));
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [draftRecord, setDraftRecord] = useState<SiteContentDraft | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (query.data && draftQuery.isSuccess) {
      setDraft((current) => current ?? draftQuery.data?.content ?? query.data);
      setDraftRecord(draftQuery.data);
    }
  }, [query.data, draftQuery.data, draftQuery.isSuccess]);

  if (query.isLoading || draftQuery.isLoading || (!draft && !query.isError && !draftQuery.isError))
    return <LoadingState rows={8} label="Loading website content" />;
  if (query.isError || draftQuery.isError || !draft) {
    return (
      <ErrorState description="Could not load website content." onRetry={() => query.refetch()} />
    );
  }

  const updateHero = (key: keyof SiteContent['hero'], value: string): void =>
    setDraft((current) => current && { ...current, hero: { ...current.hero, [key]: value } });
  const updateSlide = (
    id: 'software' | 'connected',
    key: keyof SiteContent['heroSlides'][number],
    value: string,
  ): void =>
    setDraft(
      (current) =>
        current && {
          ...current,
          heroSlides: current.heroSlides.map((slide) =>
            slide.id === id ? { ...slide, [key]: value } : slide,
          ),
        },
    );
  const moveSlide = (id: HeroSlideId, direction: -1 | 1): void =>
    setDraft((current) => {
      if (!current) return current;
      const order = [...current.heroSlideOrder];
      const position = order.indexOf(id);
      const destination = position + direction;
      if (destination < 0 || destination >= order.length) return current;
      [order[position], order[destination]] = [order[destination]!, order[position]!];
      return { ...current, heroSlideOrder: order };
    });
  const moveSection = (id: HomeSectionId, direction: -1 | 1): void =>
    setDraft((current) => {
      if (!current) return current;
      const order = [...current.sectionOrder];
      const position = order.indexOf(id);
      const destination = position + direction;
      if (destination < 0 || destination >= order.length) return current;
      [order[position], order[destination]] = [order[destination]!, order[position]!];
      return { ...current, sectionOrder: order };
    });
  const toggleSection = (id: HomeSectionId, visible: boolean): void =>
    setDraft(
      (current) =>
        current && {
          ...current,
          hiddenSections: visible
            ? current.hiddenSections.filter((value) => value !== id)
            : [...current.hiddenSections, id],
        },
    );
  const updateCta = (key: keyof SiteContent['cta'], value: string): void =>
    setDraft((current) => current && { ...current, cta: { ...current.cta, [key]: value } });
  const updateEcosystem = (
    side: 'left' | 'right',
    index: number,
    key: 'title' | 'description' | 'href',
    value: string,
  ): void =>
    setDraft((current) => {
      if (!current) return current;
      const items = current.ecosystem[side].map((item, position) =>
        position === index ? { ...item, [key]: value } : item,
      );
      return { ...current, ecosystem: { ...current.ecosystem, [side]: items } };
    });
  const updateContact = (key: 'location' | 'email' | 'phone', value: string): void =>
    setDraft((current) => current && { ...current, contact: { ...current.contact, [key]: value } });
  const updateSocial = (label: (typeof socialLabels)[number], value: string): void =>
    setDraft((current) => {
      if (!current) return current;
      const social = current.contact.social.filter((item) => item.label !== label);
      if (value.trim()) social.push({ label, url: value.trim() });
      return { ...current, contact: { ...current.contact, social } };
    });
  const toggleLogo = (id: TrustedBusinessId, checked: boolean): void =>
    setDraft((current) => {
      if (!current) return current;
      const visibleIds = checked
        ? [...current.trusted.visibleIds, id]
        : current.trusted.visibleIds.filter((value) => value !== id);
      return { ...current, trusted: { ...current.trusted, visibleIds } };
    });
  const moveLogo = (id: TrustedBusinessId, direction: -1 | 1): void =>
    setDraft((current) => {
      if (!current) return current;
      const ids = [...current.trusted.visibleIds];
      const position = ids.indexOf(id);
      const destination = position + direction;
      if (position < 0 || destination < 0 || destination >= ids.length) return current;
      [ids[position], ids[destination]] = [ids[destination]!, ids[position]!];
      return { ...current, trusted: { ...current.trusted, visibleIds: ids } };
    });
  const updateLogoAsset = (id: TrustedBusinessId, url: string): void =>
    setDraft((current) => {
      if (!current) return current;
      const assetUrls = { ...current.trusted.assetUrls };
      if (url.trim()) assetUrls[id] = url.trim();
      else delete assetUrls[id];
      return { ...current, trusted: { ...current.trusted, assetUrls } };
    });

  const save = async (): Promise<void> => {
    const parsed = siteContentSchema.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setMessage(`${issue?.path.join('.') ?? 'Content'}: ${issue?.message ?? 'Invalid value'}`);
      return;
    }
    setMessage('');
    try {
      const saved = await mutation.mutateAsync(parsed.data);
      setDraft(saved.content);
      setDraftRecord(saved);
      setMessage('Private draft saved. Submit it for independent review before publishing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save website content.');
    }
  };
  const transition = async (action: 'submit' | 'approve' | 'publish'): Promise<void> => {
    setTransitioning(true);
    setMessage('');
    try {
      if (action === 'publish') {
        const content = await publishSiteContentDraft();
        queryClient.setQueryData(QUERY_KEY, content);
        queryClient.setQueryData([...QUERY_KEY, 'draft'], null);
        setDraft(content);
        setDraftRecord(null);
        setMessage('Approved content published to the public homepage.');
      } else {
        const record =
          action === 'submit' ? await submitSiteContentDraft() : await approveSiteContentDraft();
        queryClient.setQueryData([...QUERY_KEY, 'draft'], record);
        setDraftRecord(record);
        setMessage(
          action === 'submit'
            ? 'Draft submitted for review.'
            : 'Draft approved. An administrator can now publish it.',
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update website draft.');
      await draftQuery.refetch();
    } finally {
      setTransitioning(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Website Content</h1>
        <p className="mt-1 text-sm text-muted">
          Manage the public homepage, approved logos, and contact details. Changes stay private
          until reviewed and published.
        </p>
        <p className="mt-2 text-sm font-semibold text-brand" role="status">
          {draftRecord
            ? `Draft status: ${draftRecord.status.replace('_', ' ').toLowerCase()}`
            : 'No private draft. You are viewing published content.'}
        </p>
      </div>

      <fieldset
        disabled={!canEdit || mutation.isPending || transitioning}
        className="space-y-6 disabled:opacity-70"
      >
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">Homepage sections</h2>
          <p className="mt-1 text-sm text-muted">
            The hero remains first. Show, hide, and reorder the sections below. Draft changes do not
            affect visitors.
          </p>
          <ol className="mt-4 space-y-2" aria-label="Homepage section order">
            {draft.sectionOrder.map((id, index) => (
              <li
                key={id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="w-5 text-muted">{index + 1}.</span>
                <label className="flex flex-1 items-center gap-2 font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={!draft.hiddenSections.includes(id)}
                    onChange={(event) => toggleSection(id, event.target.checked)}
                  />
                  {id === 'cta'
                    ? 'Final call to action'
                    : id === 'faq'
                      ? 'Frequently asked questions'
                      : id.charAt(0).toUpperCase() + id.slice(1)}
                </label>
                <button
                  type="button"
                  className="min-h-9 min-w-9 rounded text-brand disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveSection(id, -1)}
                  aria-label={`Move ${id} section earlier`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-9 min-w-9 rounded text-brand disabled:opacity-40"
                  disabled={index === homeSectionIds.length - 1}
                  onClick={() => moveSection(id, 1)}
                  aria-label={`Move ${id} section later`}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">Hero slider</h2>
          <p className="mt-1 text-sm text-muted">
            Three slides appear in the order below. Use approved or clearly illustrative images.
          </p>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Slide order">
            {draft.heroSlideOrder.map((id, index) => (
              <div
                key={id}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm"
              >
                <span>
                  {index + 1}.{' '}
                  {id === 'intro'
                    ? 'Digital transformation'
                    : id === 'software'
                      ? 'Custom software'
                      : 'Connected solutions'}
                </span>
                <button
                  type="button"
                  className="min-h-9 min-w-9 rounded text-brand disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveSlide(id, -1)}
                  aria-label={`Move ${id} slide earlier`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-9 min-w-9 rounded text-brand disabled:opacity-40"
                  disabled={index === draft.heroSlideOrder.length - 1}
                  onClick={() => moveSlide(id, 1)}
                  aria-label={`Move ${id} slide later`}
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-bold text-ink">Digital transformation</h3>
          <div className="mt-4 grid gap-4">
            <Field
              label="Badge"
              value={draft.hero.badge}
              onChange={(value) => updateHero('badge', value)}
            />
            <Field
              label="Headline"
              value={draft.hero.headline}
              onChange={(value) => updateHero('headline', value)}
            />
            <Field
              label="Hero image URL"
              value={draft.hero.imageUrl}
              onChange={(value) => updateHero('imageUrl', value)}
            />
            <ImageUploadControl onUploaded={(url) => updateHero('imageUrl', url)} />
            <Field
              label="Image description"
              value={draft.hero.imageAlt}
              onChange={(value) => updateHero('imageAlt', value)}
            />
            <Field
              label="Description"
              value={draft.hero.description}
              onChange={(value) => updateHero('description', value)}
              multiline
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Primary button text"
                value={draft.hero.primaryLabel}
                onChange={(value) => updateHero('primaryLabel', value)}
              />
              <Field
                label="Primary button destination"
                value={draft.hero.primaryHref}
                onChange={(value) => updateHero('primaryHref', value)}
              />
              <Field
                label="Secondary button text"
                value={draft.hero.secondaryLabel}
                onChange={(value) => updateHero('secondaryLabel', value)}
              />
              <Field
                label="Secondary button destination"
                value={draft.hero.secondaryHref}
                onChange={(value) => updateHero('secondaryHref', value)}
              />
            </div>
          </div>
          {draft.heroSlides.map((slide) => (
            <div key={slide.id} className="mt-6 grid gap-4 border-t border-border pt-6">
              <h3 className="text-sm font-bold text-ink">
                {slide.id === 'software' ? 'Custom software' : 'Connected solutions'}
              </h3>
              <Field
                label="Eyebrow"
                value={slide.badge}
                onChange={(value) => updateSlide(slide.id, 'badge', value)}
              />
              <Field
                label="Headline"
                value={slide.headline}
                onChange={(value) => updateSlide(slide.id, 'headline', value)}
              />
              <Field
                label="Description"
                value={slide.description}
                onChange={(value) => updateSlide(slide.id, 'description', value)}
                multiline
              />
              <Field
                label="Image URL (leave empty for connected illustration)"
                value={slide.imageUrl}
                onChange={(value) => updateSlide(slide.id, 'imageUrl', value)}
              />
              <ImageUploadControl onUploaded={(url) => updateSlide(slide.id, 'imageUrl', url)} />
              <Field
                label="Image description"
                value={slide.imageAlt}
                onChange={(value) => updateSlide(slide.id, 'imageAlt', value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Primary button text"
                  value={slide.primaryLabel}
                  onChange={(value) => updateSlide(slide.id, 'primaryLabel', value)}
                />
                <Field
                  label="Primary button destination"
                  value={slide.primaryHref}
                  onChange={(value) => updateSlide(slide.id, 'primaryHref', value)}
                />
                <Field
                  label="Secondary button text"
                  value={slide.secondaryLabel}
                  onChange={(value) => updateSlide(slide.id, 'secondaryLabel', value)}
                />
                <Field
                  label="Secondary button destination"
                  value={slide.secondaryHref}
                  onChange={(value) => updateSlide(slide.id, 'secondaryHref', value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">All-in-One Digital Solutions</h2>
          <p className="mt-1 text-sm text-muted">
            Edit the eight connected solution cards and their destinations.
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {(['left', 'right'] as const).map((side) => (
              <div key={side} className="space-y-4">
                <h3 className="text-sm font-bold capitalize text-ink">{side} cards</h3>
                {draft.ecosystem[side].map((item, index) => (
                  <div
                    key={`${side}-${index}`}
                    className="grid gap-3 rounded-md border border-border p-4"
                  >
                    <Field
                      label="Title"
                      value={item.title}
                      onChange={(value) => updateEcosystem(side, index, 'title', value)}
                    />
                    <Field
                      label="Description"
                      value={item.description}
                      onChange={(value) => updateEcosystem(side, index, 'description', value)}
                      multiline
                    />
                    <Field
                      label="Destination"
                      value={item.href}
                      onChange={(value) => updateEcosystem(side, index, 'href', value)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">Contact CTA</h2>
          <div className="mt-4 grid gap-4">
            <Field
              label="Headline"
              value={draft.cta.headline}
              onChange={(value) => updateCta('headline', value)}
            />
            <Field
              label="Description"
              value={draft.cta.description}
              onChange={(value) => updateCta('description', value)}
              multiline
            />
            <Field
              label="Approved background image URL (optional)"
              value={draft.cta.backgroundImageUrl}
              onChange={(value) => updateCta('backgroundImageUrl', value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">Contact details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Location"
              value={draft.contact.location}
              onChange={(value) => updateContact('location', value)}
            />
            <Field
              label="Email"
              value={draft.contact.email}
              onChange={(value) => updateContact('email', value)}
            />
            <Field
              label="Phone"
              value={draft.contact.phone}
              onChange={(value) => updateContact('phone', value)}
            />
          </div>
          <h3 className="mt-6 text-sm font-bold text-ink">Verified social profiles</h3>
          <p className="mt-1 text-xs text-muted">
            Only enter official, approved HTTPS profile links. Empty links remain unpublished.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {socialLabels.map((label) => (
              <Field
                key={label}
                label={label}
                value={draft.contact.social.find((item) => item.label === label)?.url ?? ''}
                onChange={(value) => updateSocial(label, value)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">Trusted businesses</h2>
          <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={draft.trusted.approved}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  trusted: { ...draft.trusted, approved: event.target.checked },
                })
              }
            />
            Relationship and logo publication approved
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {logos.map((logo) => (
              <div key={logo.id} className="rounded-md border border-border p-3">
                <label className="flex items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={draft.trusted.visibleIds.includes(logo.id)}
                    onChange={(event) => toggleLogo(logo.id, event.target.checked)}
                  />
                  {logo.name}
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="min-h-9 min-w-9 rounded text-brand disabled:opacity-40"
                    disabled={draft.trusted.visibleIds.indexOf(logo.id) <= 0}
                    onClick={() => moveLogo(logo.id, -1)}
                    aria-label={`Move ${logo.name} logo earlier`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="min-h-9 min-w-9 rounded text-brand disabled:opacity-40"
                    disabled={
                      draft.trusted.visibleIds.indexOf(logo.id) < 0 ||
                      draft.trusted.visibleIds.indexOf(logo.id) ===
                        draft.trusted.visibleIds.length - 1
                    }
                    onClick={() => moveLogo(logo.id, 1)}
                    aria-label={`Move ${logo.name} logo later`}
                  >
                    ↓
                  </button>
                </div>
                <Field
                  label={`${logo.name} approved logo URL (optional)`}
                  value={draft.trusted.assetUrls[logo.id] ?? ''}
                  onChange={(value) => updateLogoAsset(logo.id, value)}
                />
              </div>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        {canEdit && (
          <Button type="button" isLoading={mutation.isPending} onClick={() => void save()}>
            Save private draft
          </Button>
        )}
        {canEdit && draftRecord?.status === 'DRAFT' && (
          <Button
            type="button"
            disabled={transitioning || mutation.isPending}
            onClick={() => void transition('submit')}
          >
            Submit for review
          </Button>
        )}
        {canPublish && draftRecord?.status === 'IN_REVIEW' && draftRecord.authorId !== user?.id && (
          <Button type="button" disabled={transitioning} onClick={() => void transition('approve')}>
            Approve draft
          </Button>
        )}
        {canPublish && draftRecord?.status === 'APPROVED' && (
          <Button type="button" disabled={transitioning} onClick={() => void transition('publish')}>
            Publish approved draft
          </Button>
        )}
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </section>
  );
}

function ImageUploadControl({ onUploaded }: { onUploaded: (url: string) => void }): ReactNode {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      Or upload an image (PNG, JPG or WEBP; max 5 MB)
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={uploading}
        className="rounded-md border border-border p-2 text-sm"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const error = articleImageFileError({
            name: file.name,
            type: file.type,
            size: file.size,
          });
          if (error) {
            setMessage(error);
            return;
          }
          setUploading(true);
          setMessage('Uploading image…');
          try {
            const uploaded = await uploadArticleImage(file, undefined, undefined, 'hero');
            onUploaded(uploaded.url);
            setMessage('Image uploaded. Save website content to publish it.');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Image upload failed.');
          } finally {
            setUploading(false);
          }
        }}
      />
      <span role="status" aria-live="polite" className="text-xs text-muted">
        {message}
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}): ReactNode {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      {label}
      {multiline ? (
        <textarea
          className={areaClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={fieldClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
