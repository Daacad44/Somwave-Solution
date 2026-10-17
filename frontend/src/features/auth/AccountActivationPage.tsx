import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { newPasswordSchema, passwordPolicyStatus } from '@somwave/shared';
import { apiFetch } from '../../lib/apiClient';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import { NewPasswordFields } from './NewPasswordFields';

export function AccountActivationPage() {
  const [params, setParams] = useSearchParams();
  // Keep the credential in memory and remove it from browser history after verification.
  const [token] = useState(() => params.get('token') ?? '');
  const [verified, setVerified] = useState<{ name: string; email: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const verify = useMutation({
    mutationFn: () =>
      apiFetch<{ name: string; email: string }>('/auth/user-invitations/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: (value) => {
      setVerified(value);
      setParams({}, { replace: true });
    },
    onError: (value: Error) => setError(value.message),
  });
  const activate = useMutation({
    mutationFn: () =>
      apiFetch('/auth/user-invitations/activate', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    onSuccess: () => {
      setPassword('');
      setConfirmation('');
      setDone(true);
    },
    onError: (value: Error) => setError(value.message),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Choose a stronger password.');
      return;
    }
    if (!passwordPolicyStatus(password, verified ?? {}).private) {
      setError('Do not use your name or email in the password.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    activate.mutate();
  }
  return (
    <AuthLayout
      title="Activate your account"
      subtitle="Verify your email invitation and create your own password."
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="text-sm text-ink">
            Your account is active. Sign in using your new password.
          </p>
        ) : !token ? (
          <p role="alert" className="text-sm text-error">
            This invitation link is incomplete. Ask your administrator to resend it.
          </p>
        ) : !verified ? (
          <Button
            className="w-full"
            isLoading={verify.isPending}
            onClick={() => {
              setError('');
              verify.mutate();
            }}
          >
            Verify email
          </Button>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-ink">
              Email verified for <strong>{verified.name}</strong>
              <br />
              {verified.email}
            </p>
            <NewPasswordFields
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
              {...verified}
            />
            <Button type="submit" className="w-full" isLoading={activate.isPending}>
              Activate account
            </Button>
          </form>
        )}
        <Link to="/login" className="block text-sm text-brand hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
