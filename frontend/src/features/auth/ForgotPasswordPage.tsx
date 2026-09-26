import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@somwave/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useForgotPassword } from './hooks';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage(): ReactNode {
  const mutation = useForgotPassword();
  const [done, setDone] = useState(false);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    setDone(true);
  });

  return (
    <AuthLayout
      title="Dib-u-dejin furaha"
      subtitle="Geli iimaylkaaga. Ma sheegno in akoonku jiro iyo in kale."
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {done ? (
          <p className="text-sm text-muted" role="status">
            Haddii iimaylkaasi leeyahay akoon, waxaanu u diri doonnaa xiriir dib-u-dejin.
          </p>
        ) : (
          <>
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
    </AuthLayout>
  );
}
