import { type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useSearchParams } from 'react-router-dom';
import { updateProfileSchema, type UpdateProfileInput } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ApiError } from '../../lib/apiClient';
import { cn } from '../../lib/cn';
import { useCurrentUser, useUpdateProfile } from '../auth/hooks';
import { TwoFactorPanel } from './TwoFactorPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'personal', label: 'Personal Information' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function roleLabel(roles: readonly string[]): string {
  const role = roles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : (roles[0] ?? 'STAFF');
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SA'
  );
}

export function ProfilePage(): ReactNode {
  const { data: user } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TabId = isTab(requested) ? requested : 'overview';
  const update = useUpdateProfile();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: { name: user?.name ?? '' },
  });

  if (!user) return <Navigate to="/login" replace />;

  const onSave = form.handleSubmit(async (values) => {
    await update.mutateAsync(values);
  });

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="rounded-lg border border-border bg-surface p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand text-lg font-semibold text-surface">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{user.name}</h1>
            <p className="text-sm text-muted">{roleLabel(user.roles)}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <Badge tone={user.twoFactorEnabled ? 'success' : 'warning'}>
            {user.twoFactorEnabled ? '2FA enabled' : '2FA not enabled'}
          </Badge>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              'min-h-11 shrink-0 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              tab === item.id ? 'border-b-2 border-brand text-brand' : 'text-muted hover:text-ink',
            )}
            onClick={() => setParams(item.id === 'overview' ? {} : { tab: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="font-medium text-ink">{user.name}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="font-medium text-ink">{user.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Roles</dt>
                <dd className="font-medium text-ink">
                  {user.roles.map((role) => roleLabel([role])).join(', ')}
                </dd>
              </div>
            </dl>
          </article>
          <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Security</h2>
            <p className="mt-3 text-sm text-muted">
              Two-factor authentication is {user.twoFactorEnabled ? 'enabled' : 'not enabled'}.
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => setParams({ tab: 'security' })}
            >
              Manage security
            </Button>
          </article>
        </div>
      ) : null}

      {tab === 'personal' ? (
        <form
          onSubmit={onSave}
          className="flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm"
        >
          <Input
            label="Full name"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Input label="Email" value={user.email} disabled readOnly />
          <p className="text-sm text-muted">
            Iimaylku waa aqoonsiga gelitaanka. Lama beddeli karo halkan.
          </p>
          {update.error instanceof ApiError ? (
            <p className="text-sm text-error">{update.error.message}</p>
          ) : null}
          <Button type="submit" isLoading={update.isPending}>
            Save changes
          </Button>
        </form>
      ) : null}

      {tab === 'security' ? <TwoFactorPanel /> : null}

      {tab === 'preferences' ? (
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Preferences</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Timezone</dt>
              <dd className="font-medium text-ink">Africa/Mogadishu (UTC+3)</dd>
            </div>
            <div>
              <dt className="text-muted">Default locale</dt>
              <dd className="font-medium text-ink">Somali</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Doorashooyinkan waa kuwa goobta. Lama keydin karo wali.
          </p>
        </article>
      ) : null}
    </section>
  );
}
