import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordInput } from '@somwave/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';
import { useResetPassword } from './hooks';

export function ResetPasswordPage(): ReactNode {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const mutation = useResetPassword();
  const [done, setDone] = useState(false);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({ ...values, token });
    setDone(true);
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1 className="text-2xl font-semibold text-ink">Furaha cusub</h1>
        {done ? (
          <p className="text-sm text-muted">Furaha waa la beddelay. Hadda waad soo gali kartaa.</p>
        ) : (
          <>
            <Input
              label="Furaha cusub"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              isLoading={mutation.isPending}
              disabled={!token}
            >
              Kaydi
            </Button>
          </>
        )}
        <Link className="text-sm text-brand underline-offset-2 hover:underline" to="/login">
          Ku noqo soo-galidda
        </Link>
      </form>
    </main>
  );
}
