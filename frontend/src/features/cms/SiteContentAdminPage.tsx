import { type ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSIONS,
  siteContentSchema,
  type SiteContent,
  type TrustedBusinessId,
  type HeroSlideId,
} from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/states';
import { useHasPermission } from '../../lib/rbac';
import { getSiteContent, saveSiteContent } from './api';

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
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: saveSiteContent,
    onSuccess: (saved) => queryClient.setQueryData(QUERY_KEY, saved),
  });
  const canEdit = useHasPermission(PERMISSIONS.CONTENT_UPDATE);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (query.data) setDraft((current) => current ?? query.data);
  }, [query.data]);

  if (query.isLoading || (!draft && !query.isError))
    return <LoadingState rows={8} label="Loading website content" />;
  if (query.isError || !draft) {
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
      setDraft(saved);
      setMessage('Website content saved. The homepage will use these values on the next request.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save website content.');
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Website Content</h1>
        <p className="mt-1 text-sm text-muted">
          Manage the public homepage, approved logos, and contact details.
        </p>
      </div>

      <fieldset disabled={!canEdit || mutation.isPending} className="space-y-6 disabled:opacity-70">
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
            Save website content
          </Button>
        )}
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </section>
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
