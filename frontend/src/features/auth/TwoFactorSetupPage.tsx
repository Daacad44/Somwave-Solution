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
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const form = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });

  const onStart = async (): Promise<void> => {
    const result = await start.mutateAsync();
    setSetup(result);
  };

  const onConfirm = form.handleSubmit(async (values) => {
    const result = await confirm.mutateAsync(values);
    setBackupCodes(result.backupCodes);
  });

  const error =
    start.error instanceof ApiError
      ? start.error.message
      : confirm.error instanceof ApiError
        ? confirm.error.message
        : start.error || confirm.error
          ? 'Something went wrong'
          : null;

  if (backupCodes) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-ink">Backup codes</h1>
        <p className="mt-2 max-w-xl text-base text-muted">
          Store these codes securely. Each code can be used only once.
        </p>
        <ul className="mt-4 grid max-w-md grid-cols-2 gap-2 font-mono text-sm text-ink">
          {backupCodes.map((code) => (
            <li key={code} className="rounded-md border border-border bg-surface px-3 py-2">
              {code}
            </li>
          ))}
        </ul>
        <Button className="mt-6" onClick={() => navigate('/', { replace: true })}>
          I have saved them
        </Button>
      </section>
    );
  }

  if (user?.twoFactorEnabled) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-ink">Two-factor authentication (2FA)</h1>
        <p className="mt-2 text-base text-muted">2FA is enabled for your account.</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Enable 2FA</h1>
      <p className="mt-2 max-w-xl text-base text-muted">
        Your role requires two-factor authentication. Add the secret to Google Authenticator or a
        similar app, then enter the code.
      </p>
      {!setup ? (
        <div className="mt-6">
          {error ? <p className="mb-3 text-sm text-error">{error}</p> : null}
          <Button onClick={onStart} isLoading={start.isPending}>
            Start setup
          </Button>
        </div>
      ) : (
        <form onSubmit={onConfirm} className="mt-6 flex max-w-md flex-col gap-4" noValidate>
          <p className="break-all rounded-md border border-border bg-surface p-3 text-sm text-ink">
            {setup.otpauthUrl}
          </p>
          <p className="text-sm text-muted">
            Or enter the secret manually:{' '}
            <span className="font-medium text-ink">{setup.secret}</span>
          </p>
          <Input
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={form.formState.errors.code?.message}
            {...form.register('code')}
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" isLoading={form.formState.isSubmitting || confirm.isPending}>
            Verify and enable
          </Button>
        </form>
      )}
    </section>
  );
}
