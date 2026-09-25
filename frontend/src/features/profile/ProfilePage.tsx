import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { changeOwnPasswordSchema, updateOwnProfileSchema } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../lib/apiClient';
import { cn } from '../../lib/cn';
import { DISPLAY_TIMEZONE } from '../../lib/date';
import {
  useChangeOwnPassword,
  useCurrentUser,
  useLogout,
  useUpdateOwnProfile,
} from '../auth/hooks';
import { formatRoleName, initials } from '../../lib/name';
import { TwoFactorPanel } from './TwoFactorPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'personal', label: 'Personal Information' },
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export function ProfilePage(): ReactNode {
  const { data: user } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const tab = isTab(params.get('tab')) ? params.get('tab')! : 'overview';
  const roleLabel = formatRoleName(user?.roles[0] ?? 'STAFF');

  const setTab = (next: TabId): void => {
    setParams(next === 'overview' ? {} : { tab: next }, { replace: true });
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand text-xl font-semibold text-surface">
            {initials(user?.name ?? 'SA')}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{user?.name}</h1>
            <p className="text-sm font-medium text-brand">{roleLabel}</p>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-1 border-t border-border pt-4" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={cn(
                'min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                tab === item.id ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas',
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Personal Information</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="font-medium text-ink">{user?.name}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="font-medium text-ink">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Role</dt>
                <dd className="font-medium text-ink">{roleLabel}</dd>
              </div>
            </dl>
          </article>
          <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Security</h2>
            <p className="mt-2 text-sm text-muted">
              Two-factor authentication is {user?.twoFactorEnabled ? 'enabled' : 'not enabled'}.
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => setTab('security')}>
              Manage security
            </Button>
          </article>
        </div>
      ) : null}

      {tab === 'personal' ? <PersonalForm name={user?.name ?? ''} /> : null}
      {tab === 'account' ? <AccountForm email={user?.email ?? ''} /> : null}
      {tab === 'security' ? <TwoFactorPanel /> : null}
      {tab === 'preferences' ? (
        <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Preferences</h2>
          <p className="mt-2 text-sm text-muted">
            Display timezone and locale are set by the platform. They cannot be changed from this
            screen yet.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Timezone</dt>
              <dd className="font-medium text-ink">{DISPLAY_TIMEZONE}</dd>
            </div>
            <div>
              <dt className="text-muted">Locale</dt>
              <dd className="font-medium text-ink">Somali / English</dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}

function PersonalForm({ name }: { name: string }): ReactNode {
  const update = useUpdateOwnProfile();
  const [value, setValue] = useState(name);
  const parsed = useMemo(() => updateOwnProfileSchema.safeParse({ name: value }), [value]);
  const error = update.error instanceof ApiError ? update.error.message : null;

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!parsed.success) return;
    await update.mutateAsync(parsed.data);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-ink">Personal Information</h2>
      <Input
        label="Name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={parsed.success ? undefined : parsed.error.flatten().fieldErrors.name?.[0]}
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {update.isSuccess ? <p className="text-sm text-success">Profile updated.</p> : null}
      <Button type="submit" isLoading={update.isPending} disabled={!parsed.success}>
        Save changes
      </Button>
    </form>
  );
}

function AccountForm({ email }: { email: string }): ReactNode {
  const change = useChangeOwnPassword();
  const logout = useLogout();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const parsed = useMemo(
    () => changeOwnPasswordSchema.safeParse({ currentPassword, password }),
    [currentPassword, password],
  );
  const error = change.error instanceof ApiError ? change.error.message : null;

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!parsed.success) return;
    await change.mutateAsync(parsed.data);
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-ink">Account</h2>
      <Input label="Email" value={email} readOnly />
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={parsed.success ? undefined : parsed.error.flatten().fieldErrors.password?.[0]}
      />
      <p className="text-sm text-muted">Changing your password signs you out of this session.</p>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button type="submit" isLoading={change.isPending}>
        Update password
      </Button>
    </form>
  );
}
