import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { newPasswordSchema } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { apiFetch } from '../../lib/apiClient';
import { AuthLayout } from './AuthLayout';
import { NewPasswordFields } from './NewPasswordFields';

// Keep existing reset links usable while new reset requests use the email OTP flow.
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const reset = useMutation({
    mutationFn: () =>
      apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    onSuccess: () => {
      setPassword('');
      setConfirmation('');
    },
    onError: (value: Error) => setError(value.message),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const result = newPasswordSchema.safeParse(password);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Choose a stronger password.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    reset.mutate();
  }
  return (
    <AuthLayout title="New password" subtitle="Choose the password you will use next.">
      <form className="space-y-4" onSubmit={submit}>
        {reset.isSuccess ? (
          <p role="status" className="text-sm text-ink">
            Your password has been changed. You can sign in now.
          </p>
        ) : token ? (
          <>
            <NewPasswordFields
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
            />
            <Button type="submit" className="w-full" isLoading={reset.isPending}>
              Save new password
            </Button>
          </>
        ) : (
          <p role="alert" className="text-sm text-error">
            The reset link is incomplete.{' '}
            <Link to="/forgot-password" className="text-brand underline">
              Request a verification code
            </Link>
            .
          </p>
        )}
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <Link to="/login" className="block text-sm text-brand hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
