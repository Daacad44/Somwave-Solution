import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  loginSchema,
  verifyTwoFactorSchema,
  type LoginInput,
  type VerifyTwoFactorInput,
} from '@somwave/shared';
import { ApiError } from '../../lib/apiClient';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useLogin, useVerifyTwoFactor } from './hooks';

export function LoginPage(): ReactNode {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const verifyMutation = useVerifyTwoFactor();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const loginForm = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const codeForm = useForm<VerifyTwoFactorInput>({
    resolver: zodResolver(verifyTwoFactorSchema),
    defaultValues: { challengeToken: '', code: '' },
  });

  const onLogin = loginForm.handleSubmit(async (values) => {
    try {
      const result = await loginMutation.mutateAsync(values);
      if (result.twoFactorRequired) {
        setChallengeToken(result.challengeToken);
        codeForm.setValue('challengeToken', result.challengeToken);
        return;
      }
      navigate('/', { replace: true });
    } catch {
      // Mutation error is rendered below; do not let RHF treat it as unhandled.
    }
  });

  const onVerify = codeForm.handleSubmit(async (values) => {
    try {
      await verifyMutation.mutateAsync(values);
      navigate('/', { replace: true });
    } catch {
      // Mutation error is rendered below.
    }
  });

  const serverError =
    (loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.error
        ? 'Wax baa qaldamay'
        : null) ??
    (verifyMutation.error instanceof ApiError
      ? verifyMutation.error.message
      : verifyMutation.error
        ? 'Wax baa qaldamay'
        : null);

  if (challengeToken) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={onVerify} noValidate>
          <h1 className="text-2xl font-semibold text-ink">Somwave</h1>
          <p className="text-sm text-muted">Geli koodhka 2FA ee app-kaaga.</p>
          <input type="hidden" {...codeForm.register('challengeToken')} />
          <Input
            label="Koodhka 2FA"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={codeForm.formState.errors.code?.message}
            {...codeForm.register('code')}
          />
          {serverError ? <p className="form-error">{serverError}</p> : null}
          <Button
            type="submit"
            className="w-full"
            isLoading={codeForm.formState.isSubmitting || verifyMutation.isPending}
          >
            Xaqiiji
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onLogin} noValidate>
        <h1 className="text-2xl font-semibold text-ink">Somwave</h1>
        <p className="text-sm text-muted">Soo gal akoonkaaga.</p>
        <Input
          label="Iimayl"
          type="email"
          autoComplete="email"
          error={loginForm.formState.errors.email?.message}
          {...loginForm.register('email')}
        />
        <Input
          label="Furaha"
          type="password"
          autoComplete="current-password"
          error={loginForm.formState.errors.password?.message}
          {...loginForm.register('password')}
        />
        {serverError ? <p className="form-error">{serverError}</p> : null}
        <Button
          type="submit"
          className="w-full"
          isLoading={loginForm.formState.isSubmitting || loginMutation.isPending}
        >
          Soo gal
        </Button>
        <p className="text-sm text-muted">
          <Link className="text-brand underline-offset-2 hover:underline" to="/forgot-password">
            Ma hilmaamtay furaha?
          </Link>
        </p>
      </form>
    </main>
  );
}
