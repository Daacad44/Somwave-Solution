import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { newPasswordSchema, passwordPolicyStatus } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiFetch } from '../../lib/apiClient';
import { AuthLayout } from './AuthLayout';

interface VerifiedInvitation {
  activationToken: string;
  name: string;
  email: string;
  expiresAt: string;
  existingAccount: boolean;
  profile: {
    phone?: string | null;
    jobTitle?: string | null;
    specialization?: string | null;
    experienceLevel?: string | null;
    employmentType?: string | null;
  } | null;
}

export function EngineerActivationPage(): ReactNode {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [verified, setVerified] = useState<VerifiedInvitation | null>(null);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('MID');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [message, setMessage] = useState('');
  const newAccount = verified !== null && !verified.existingAccount;
  const passwordStatus = passwordPolicyStatus(password, {
    name: verified?.name,
    email: verified?.email,
  });
  const satisfied = Object.values(passwordStatus).filter(Boolean).length;
  const strength = !password
    ? 'Not set'
    : satisfied < 5
      ? 'Weak'
      : satisfied < 7
        ? 'Fair'
        : 'Strong';
  const verify = useMutation({
    mutationFn: () =>
      apiFetch<VerifiedInvitation>('/auth/engineer-invitations/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: (result) => {
      setVerified(result);
      setResendEmail(result.email);
      setJobTitle(result.profile?.jobTitle ?? '');
      setSpecialization(result.profile?.specialization ?? '');
      setExperienceLevel(result.profile?.experienceLevel ?? 'MID');
      setEmploymentType(result.profile?.employmentType ?? 'FULL_TIME');
      setMessage(
        result.existingAccount
          ? 'Email verified. Enter your current password to accept the engineer role.'
          : 'Email verified. Complete your profile and create a password.',
      );
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const activate = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/auth/engineer-invitations/activate', {
        method: 'POST',
        body: JSON.stringify({
          activationToken: verified?.activationToken,
          password,
          ...(!verified?.existingAccount ? { confirmPassword: confirmation } : {}),
          jobTitle,
          specialization,
          experienceLevel,
          employmentType,
        }),
      }),
    onSuccess: () => {
      setDone(true);
      setVerified(null);
      setPassword('');
      setConfirmation('');
      setMessage('Your engineer account is active. You can sign in now.');
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const resend = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/auth/engineer-invitations/resend', {
        method: 'POST',
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      }),
    onSuccess: () => {
      setVerified(null);
      verify.reset();
      activate.reset();
      setMessage(
        'If an invitation is available for this email, a new link will be sent. Check your inbox.',
      );
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const submitActivation = (event: FormEvent): void => {
    event.preventDefault();
    if (newAccount) {
      const parsed = newPasswordSchema.safeParse(password);
      if (!parsed.success) {
        setMessage(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
        return;
      }
      if (!passwordStatus.private) {
        setMessage('Do not use your name or email in the password.');
        return;
      }
      if (password !== confirmation) {
        setMessage('Passwords do not match.');
        return;
      }
    }
    setMessage('');
    activate.mutate();
  };
  return (
    <AuthLayout
      title="Activate engineer account"
      subtitle="Verify your invitation and set up your Somwave Solution account."
    >
      <div className="space-y-4">
        {message ? (
          <p
            role={verify.isError || activate.isError || resend.isError ? 'alert' : 'status'}
            className={`text-sm ${verify.isError || activate.isError || resend.isError ? 'text-error' : 'text-muted'}`}
          >
            {message}
          </p>
        ) : null}
        {!token && !verified && !done ? (
          <p role="alert" className="text-sm text-error">
            This invitation link is incomplete. Ask your administrator to resend it.
          </p>
        ) : null}
        {token && !verified && !done ? (
          <>
            <p className="text-sm text-muted">
              The verification link can be used once. After verifying, finish activation on this
              page before closing it.
            </p>
            <Button
              className="w-full"
              disabled={verify.isPending}
              isLoading={verify.isPending}
              onClick={() => {
                setMessage('');
                verify.mutate();
              }}
            >
              Verify email
            </Button>
          </>
        ) : null}
        {verified && !done ? (
          <form className="space-y-4" onSubmit={submitActivation}>
            <p className="text-sm text-muted">
              <strong>{verified.name}</strong>
              <br />
              {verified.email}
            </p>
            <Input
              label="Job title"
              required
              maxLength={120}
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
            <Input
              label="Engineering specialization"
              required
              maxLength={120}
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
            />
            <label className="block text-sm">
              Experience level
              <select
                className="mt-1 w-full rounded border border-border bg-surface p-3"
                value={experienceLevel}
                onChange={(event) => setExperienceLevel(event.target.value)}
              >
                <option value="JUNIOR">Junior</option>
                <option value="MID">Mid-level</option>
                <option value="SENIOR">Senior</option>
                <option value="PRINCIPAL">Principal</option>
              </select>
            </label>
            <label className="block text-sm">
              Employment type
              <select
                className="mt-1 w-full rounded border border-border bg-surface p-3"
                value={employmentType}
                onChange={(event) => setEmploymentType(event.target.value)}
              >
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </label>
            <Input
              label={verified.existingAccount ? 'Current password' : 'Create password'}
              type={showPassword ? 'text' : 'password'}
              autoComplete={verified.existingAccount ? 'current-password' : 'new-password'}
              minLength={newAccount ? 12 : undefined}
              maxLength={newAccount ? 128 : 1024}
              required
              value={password}
              aria-describedby={newAccount ? 'engineer-password-requirements' : undefined}
              onChange={(event) => setPassword(event.target.value)}
              trailing={
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="inline-flex h-11 w-11 items-center justify-center text-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            {newAccount ? (
              <>
                <div
                  id="engineer-password-requirements"
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium">Password requirements</p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {(
                      [
                        ['length', 'Use 12 to 128 characters'],
                        ['uppercase', 'Include an uppercase letter'],
                        ['lowercase', 'Include a lowercase letter'],
                        ['number', 'Include a number'],
                        ['special', 'Include a special character'],
                        ['uncommon', 'Avoid common passwords'],
                        ['private', 'Avoid your name or email'],
                      ] as const
                    ).map(([key, label]) => (
                      <li key={key} className={passwordStatus[key] ? 'text-ink' : 'text-muted'}>
                        {passwordStatus[key] ? '✓' : '○'} {label}
                      </li>
                    ))}
                  </ul>
                  <p role="status" aria-live="polite" className="mt-2 font-medium">
                    Password strength: {strength}
                  </p>
                </div>
                <Input
                  label="Confirm password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  maxLength={128}
                  required
                  value={confirmation}
                  error={
                    confirmation && confirmation !== password
                      ? 'Passwords do not match.'
                      : undefined
                  }
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </>
            ) : null}
            <p className="text-xs text-muted">
              This activation step expires {new Date(verified.expiresAt).toLocaleString()}.
            </p>
            <Button
              type="submit"
              className="w-full"
              disabled={activate.isPending}
              isLoading={activate.isPending}
            >
              Activate account
            </Button>
          </form>
        ) : null}
        {!done ? (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              className="text-sm text-brand hover:underline"
              onClick={() => setResendOpen(!resendOpen)}
            >
              Invitation link expired or unavailable?
            </button>
            {resendOpen ? (
              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setMessage('');
                  resend.mutate();
                }}
              >
                <Input
                  label="Invited email address"
                  type="email"
                  required
                  maxLength={255}
                  value={resendEmail}
                  onChange={(event) => setResendEmail(event.target.value)}
                />
                <Button type="submit" variant="secondary" isLoading={resend.isPending}>
                  Request a new link
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
        <Link
          className="block text-sm text-brand hover:underline"
          to={done ? '/login?next=%2Fengineering' : '/login'}
        >
          {done ? 'Sign in to Engineering Workspace' : 'Back to sign in'}
        </Link>
      </div>
    </AuthLayout>
  );
}
