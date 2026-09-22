import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { confirmTwoFactorSchema, type ConfirmTwoFactorInput } from '@somwave/shared';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';
import { useConfirmTwoFactor, useCurrentUser, useStartTwoFactor } from './hooks';

export function TwoFactorSetupPage(): ReactNode {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const start = useStartTwoFactor();
  const confirm = useConfirmTwoFactor();
  const [setup, setSetup] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const form = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });

  const onStart = async (): Promise<void> => {
    const result = await start.mutateAsync();
    setSetup(result);
  };

  const onConfirm = form.handleSubmit(async (values) => {
    await confirm.mutateAsync(values);
    navigate('/', { replace: true });
  });

  const error =
    start.error instanceof ApiError
      ? start.error.message
      : confirm.error instanceof ApiError
        ? confirm.error.message
        : start.error || confirm.error
          ? 'Wax baa qaldamay'
          : null;

  if (user?.twoFactorEnabled) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-ink">Laba-tallaabo (2FA)</h1>
        <p className="mt-2 text-base text-muted">2FA waa shaqeynayaa akoonkaagan.</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Shid 2FA</h1>
      <p className="mt-2 max-w-xl text-base text-muted">
        Doorkaaga wuxuu u baahan yahay xaqiijin laba-tallaabo. Ku dar sirta app-ka Google
        Authenticator ama mid la mid ah, kadib geli koodhka.
      </p>
      {!setup ? (
        <div className="mt-6">
          {error ? <p className="mb-3 text-sm text-error">{error}</p> : null}
          <Button onClick={onStart} isLoading={start.isPending}>
            Bilow diiwaangelinta
          </Button>
        </div>
      ) : (
        <form onSubmit={onConfirm} className="mt-6 flex max-w-md flex-col gap-4" noValidate>
          <p className="break-all rounded-md border border-border bg-surface p-3 text-sm text-ink">
            {setup.otpauthUrl}
          </p>
          <p className="text-sm text-muted">
            Ama geli sirta gacanta: <span className="font-medium text-ink">{setup.secret}</span>
          </p>
          <Input
            label="Koodhka 6-lambar"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={form.formState.errors.code?.message}
            {...form.register('code')}
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" isLoading={form.formState.isSubmitting || confirm.isPending}>
            Xaqiiji oo shid
          </Button>
        </form>
      )}
    </section>
  );
}
