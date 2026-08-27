// Login screen (SYSTEM_PROMPT §11: the shared loginSchema drives the RHF resolver,
// so a field cannot be valid on the client and rejected by the server).
// Minimal styling only — the design system (tokens, UI kit) lands in F0.4.
import { type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@somwave/shared';
import { ApiError } from '../../lib/apiClient';
import { useLogin } from './hooks';

export function LoginPage(): ReactNode {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await loginMutation.mutateAsync(values);
    navigate('/', { replace: true });
  });

  const serverError =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.error
        ? 'Something went wrong'
        : null;

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1>Somwave</h1>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email ? <p className="field-error">{errors.email.message}</p> : null}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password ? <p className="field-error">{errors.password.message}</p> : null}

        {serverError ? <p className="form-error">{serverError}</p> : null}

        <button type="submit" disabled={isSubmitting || loginMutation.isPending}>
          {isSubmitting || loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
