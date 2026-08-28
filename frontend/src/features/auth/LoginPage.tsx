// Login screen (SYSTEM_PROMPT §11: the shared loginSchema drives the RHF resolver,
// so a field cannot be valid on the client and rejected by the server).
import { type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@somwave/shared';
import { ApiError } from '../../lib/apiClient';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
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
        <h1 className="text-2xl font-semibold text-ink">Somwave</h1>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {serverError ? <p className="form-error">{serverError}</p> : null}
        <Button
          type="submit"
          className="w-full"
          isLoading={isSubmitting || loginMutation.isPending}
        >
          Sign in
        </Button>
      </form>
    </main>
  );
}
