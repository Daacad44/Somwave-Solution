import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, newPasswordSchema, passwordPolicyStatus } from '@somwave/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { apiFetch } from '../../lib/apiClient';
import { AuthLayout } from './AuthLayout';
import { NewPasswordFields } from './NewPasswordFields';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'done'>('email');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const request = useMutation({
    mutationFn: () =>
      apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }),
    onSuccess: () => {
      setStep('code');
      setCooldown(60);
      setCode('');
    },
    onError: (value: Error) => setError(value.message),
  });
  const verify = useMutation({
    mutationFn: () =>
      apiFetch<{ token: string }>('/auth/password-reset/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      }),
    onSuccess: (result) => {
      setToken(result.token);
      setCode('');
      setStep('password');
    },
    onError: (value: Error) => setError(value.message),
  });
  const reset = useMutation({
    mutationFn: () =>
      apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    onSuccess: () => {
      setToken('');
      setPassword('');
      setConfirmation('');
      setStep('done');
    },
    onError: (value: Error) => setError(value.message),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (step === 'email') {
      const result = forgotPasswordSchema.safeParse({ email: email.trim() });
      if (!result.success) {
        setError('Enter a valid email address.');
        return;
      }
      request.mutate();
    } else if (step === 'code') {
      if (!/^\d{6}$/.test(code)) {
        setError('Enter the six-digit verification code.');
        return;
      }
      verify.mutate();
    } else if (step === 'password') {
      const result = newPasswordSchema.safeParse(password);
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? 'Choose a stronger password.');
        return;
      }
      if (!passwordPolicyStatus(password, { email }).private) {
        setError('Do not use your email in the password.');
        return;
      }
      if (password !== confirmation) {
        setError('Passwords do not match.');
        return;
      }
      reset.mutate();
    }
  }
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Verify your email before choosing a new password."
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {step === 'email' ? (
          <>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" isLoading={request.isPending}>
              Send verification code
            </Button>
          </>
        ) : null}
        {step === 'code' ? (
          <>
            <p role="status" className="text-sm text-muted">
              If an account exists for that email address, a verification code will be sent. Check
              your inbox and spam folder. Codes expire after a short time.
            </p>
            <Input
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
            <Button type="submit" isLoading={verify.isPending}>
              Verify code
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={cooldown > 0 || request.isPending}
              onClick={() => {
                setError('');
                request.mutate();
              }}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Button>
            <button
              type="button"
              className="text-sm text-brand hover:underline"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
            >
              Use a different email
            </button>
          </>
        ) : null}
        {step === 'password' ? (
          <>
            <NewPasswordFields
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
              email={email}
            />
            <Button type="submit" isLoading={reset.isPending}>
              Save new password
            </Button>
          </>
        ) : null}
        {step === 'done' ? (
          <p role="status" className="text-sm text-ink">
            Your password has been changed and previous sessions have ended. Sign in using your new
            password.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <Link className="text-sm text-brand hover:underline" to="/login">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
