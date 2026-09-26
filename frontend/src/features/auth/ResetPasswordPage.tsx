import { type ReactNode, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordInput } from '@somwave/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';
import { useResetPassword } from './hooks';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage(): ReactNode {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const mutation = useResetPassword();
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout title="Furaha cusub" subtitle="Dooro furaha aad isticmaali doonto marka xigta.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {done ? (
          <p className="text-sm text-muted" role="status">
            Furaha waa la beddelay. Hadda waad soo gali kartaa.
          </p>
        ) : (
          <>
            <Input
              label="Furaha cusub"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              trailing={
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label={showPassword ? 'Qari furaha' : 'Muuji furaha'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
              {...form.register('password')}
            />
            {!token ? (
              <p className="text-sm text-error">Xiriirka dib-u-dejinta ma dhammaystirna.</p>
            ) : null}
            {error ? <p className="text-sm text-error">{error}</p> : null}
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
    </AuthLayout>
  );
}
