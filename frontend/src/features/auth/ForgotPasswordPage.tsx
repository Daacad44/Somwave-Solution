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
        <h1 className="text-2xl font-semibold text-ink">Dib-u-dejin furaha</h1>
        {done ? (
          <p className="text-sm text-muted">
            Haddii iimaylkaasi leeyahay akoon, waxaanu u diri doonnaa xiriir dib-u-dejin.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Geli iimaylkaaga. Ma sheegno in akoonku jiro iyo in kale.
            </p>
            <Input
              label="Iimayl"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Button type="submit" className="w-full" isLoading={mutation.isPending}>
              Dir xiriirka
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
