import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@somwave/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useForgotPassword } from './hooks';

export function ForgotPasswordPage(): ReactNode {
  const mutation = useForgotPassword();
  const [done, setDone] = useState(false);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    setDone(true);
  });

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1 className="text-2xl font-semibold text-ink">Reset your password</h1>
        {done ? (
          <p className="text-sm text-muted">
            If an account exists for that email address, we will send a reset link.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Enter your email address. We will not disclose whether an account exists.
            </p>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Button type="submit" className="w-full" isLoading={mutation.isPending}>
              Send reset link
            </Button>
          </>
        )}
        <Link className="text-sm text-brand underline-offset-2 hover:underline" to="/login">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
