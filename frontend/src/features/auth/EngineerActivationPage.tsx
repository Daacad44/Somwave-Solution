import { type FormEvent, type ReactNode, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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
    if (password.length < 12 || password.length > 200) {
      setMessage('Password must be between 12 and 200 characters.');
      return;
    }
    if (!verified?.existingAccount && password !== confirmation) {
      setMessage('The passwords do not match.');
      return;
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
              label={verified.existingAccount ? 'Current password' : 'New password'}
              type={showPassword ? 'text' : 'password'}
              autoComplete={verified.existingAccount ? 'current-password' : 'new-password'}
              minLength={12}
              maxLength={200}
              required
              value={password}
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
            {!verified.existingAccount ? (
              <Input
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
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
        <Link className="block text-sm text-brand hover:underline" to="/login">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
