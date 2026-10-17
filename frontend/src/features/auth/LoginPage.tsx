import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
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
import { AuthLayout } from './AuthLayout';
import { loginDestination } from './loginDestination';

export function LoginPage(): ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPath = searchParams.get('next');
  const loginMutation = useLogin();
  const verifyMutation = useVerifyTwoFactor();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      navigate(loginDestination(result.user, requestedPath), {
        replace: true,
      });
    } catch {
      // Mutation error is rendered below; do not let RHF treat it as unhandled.
    }
  });

  const onVerify = codeForm.handleSubmit(async (values) => {
    try {
      const result = await verifyMutation.mutateAsync(values);
      navigate(loginDestination(result.user, requestedPath), {
        replace: true,
      });
    } catch {
      // Mutation error is rendered below.
    }
  });

  const serverError =
    (loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.error
        ? 'Something went wrong'
        : null) ??
    (verifyMutation.error instanceof ApiError
      ? verifyMutation.error.message
      : verifyMutation.error
        ? 'Something went wrong'
        : null);

  if (challengeToken) {
    return (
      <AuthLayout
        title="Verify your sign-in"
        subtitle="Enter the 2FA code from your authenticator app."
      >
        <form className="flex flex-col gap-4" onSubmit={onVerify} noValidate>
          <input type="hidden" {...codeForm.register('challengeToken')} />
          <Input
            label="2FA code"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={codeForm.formState.errors.code?.message}
            {...codeForm.register('code')}
          />
          {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
          <Button
            type="submit"
            className="w-full"
            isLoading={codeForm.formState.isSubmitting || verifyMutation.isPending}
          >
            Verify
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" subtitle="Sign in to your account to continue.">
      <form className="flex flex-col gap-4" onSubmit={onLogin} noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={loginForm.formState.errors.email?.message}
          {...loginForm.register('email')}
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          error={loginForm.formState.errors.password?.message}
          trailing={
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
          {...loginForm.register('password')}
        />
        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}
        <Button
          type="submit"
          className="w-full"
          isLoading={loginForm.formState.isSubmitting || loginMutation.isPending}
        >
          Sign in
        </Button>
        <p className="text-sm text-muted">
          <Link className="text-brand underline-offset-2 hover:underline" to="/forgot-password">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
