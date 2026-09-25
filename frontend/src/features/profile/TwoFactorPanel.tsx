import { type ReactNode, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  confirmTwoFactorSchema,
  disableTwoFactorSchema,
  type ConfirmTwoFactorInput,
  type DisableTwoFactorInput,
} from '@somwave/shared';
import { Check, Copy, Download, Shield } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ApiError } from '../../lib/apiClient';
import { qrSvg } from '../../lib/qr';
import { useToast } from '../../components/ui/Toast';
import {
  useConfirmTwoFactor,
  useCurrentUser,
  useDisableTwoFactor,
  useRegenerateBackupCodes,
  useStartTwoFactor,
} from '../auth/hooks';

function mutationError(error: unknown): string | null {
  if (error instanceof ApiError) return error.message;
  if (error) return 'Wax baa qaldamay';
  return null;
}

export function TwoFactorPanel(): ReactNode {
  const { data: user } = useCurrentUser();
  const start = useStartTwoFactor();
  const confirm = useConfirmTwoFactor();
  const disable = useDisableTwoFactor();
  const regenerate = useRegenerateBackupCodes();
  const { toast } = useToast();
  const [setup, setSetup] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const qr = useMemo(() => (setup ? qrSvg(setup.otpauthUrl) : null), [setup]);

  const confirmForm = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });
  const disableForm = useForm<DisableTwoFactorInput>({
    resolver: zodResolver(disableTwoFactorSchema),
    defaultValues: { code: '' },
  });
  const manageForm = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });

  const onStart = async (): Promise<void> => {
    const result = await start.mutateAsync();
    setSetup(result);
    setBackupCodes(null);
    setSaved(false);
  };

  const onConfirm = confirmForm.handleSubmit(async (values) => {
    const result = await confirm.mutateAsync(values);
    setBackupCodes(result.backupCodes);
    setSetup(null);
  });

  const onDisable = disableForm.handleSubmit(async (values) => {
    await disable.mutateAsync(values);
    setDisableOpen(false);
    disableForm.reset();
    toast('2FA waa la damiyay', 'success');
  });

  const onRegenerate = manageForm.handleSubmit(async (values) => {
    const result = await regenerate.mutateAsync(values);
    setBackupCodes(result.backupCodes);
    setSaved(false);
    setManageOpen(false);
    manageForm.reset();
  });

  const copyCodes = async (): Promise<void> => {
    if (!backupCodes) return;
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    toast('Koodhyada waa la koobiyey', 'success');
  };

  const downloadCodes = (): void => {
    if (!backupCodes) return;
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'somwave-2fa-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (backupCodes) {
    return (
      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-ink">Koodhyada kaydka</h3>
        <p className="mt-2 text-sm text-muted">
          Kaydi koodhyadan meel ammaan ah. Mid kasta hal mar ayaa la isticmaali karaa. Sirta
          authenticator-ka lama soo bandhigo mar dambe.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm text-ink">
          {backupCodes.map((code) => (
            <li key={code} className="rounded-md border border-border bg-canvas px-3 py-2">
              {code}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void copyCodes()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy codes
          </Button>
          <Button variant="secondary" onClick={downloadCodes}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download codes
          </Button>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
          />
          I&apos;ve saved my codes
        </label>
        <Button className="mt-3" disabled={!saved} onClick={() => setBackupCodes(null)}>
          I&apos;ve saved my codes
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Shield className="h-5 w-5 text-brand" aria-hidden="true" />
            Two-Factor Authentication
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Ku xooji akoonkaaga xaqiijin laba-tallaabo ah si aad uga ilaaliso gelitaanka aan la
            oggolayn.
          </p>
        </div>
        <Badge tone={user?.twoFactorEnabled ? 'success' : 'warning'}>
          {user?.twoFactorEnabled ? 'Enabled' : 'Not enabled'}
        </Badge>
      </div>

      {user?.twoFactorEnabled && !setup ? (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <Check className="h-4 w-4" aria-hidden="true" />
            Two-factor authentication is enabled
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setManageOpen(true)}>
              Manage 2FA
            </Button>
            {user.twoFactorRequired ? (
              <p className="self-center text-sm text-muted">
                Doorkaagan wuxuu u baahan yahay 2FA, lama dami karo.
              </p>
            ) : (
              <Button variant="danger" onClick={() => setDisableOpen(true)}>
                Disable 2FA
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {!user?.twoFactorEnabled && !setup ? (
        <div className="mt-5">
          {mutationError(start.error) ? (
            <p className="mb-3 text-sm text-error">{mutationError(start.error)}</p>
          ) : null}
          <Button onClick={() => void onStart()} isLoading={start.isPending}>
            Enable 2FA
          </Button>
        </div>
      ) : null}

      {setup ? (
        <form onSubmit={onConfirm} className="mt-6 flex flex-col gap-5" noValidate>
          <ol className="grid gap-4 md:grid-cols-2">
            <li className="rounded-lg border border-border bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Step 1–3
              </p>
              <p className="mt-1 text-sm font-medium text-ink">Scan the QR code</p>
              {qr ? (
                <div className="mt-3 w-48 text-primary" dangerouslySetInnerHTML={{ __html: qr }} />
              ) : null}
              <p className="mt-3 text-xs text-muted">
                Ama geli sirta gacanta haddii aadan scan-garayn karin.
              </p>
              <p className="mt-1 break-all font-mono text-sm text-ink">{setup.secret}</p>
            </li>
            <li className="rounded-lg border border-border bg-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Step 4–5
              </p>
              <p className="mt-1 text-sm font-medium text-ink">Enter the 6-digit code</p>
              <Input
                className="mt-3"
                label="Koodhka 6-lambar"
                inputMode="numeric"
                autoComplete="one-time-code"
                error={confirmForm.formState.errors.code?.message}
                {...confirmForm.register('code')}
              />
              {mutationError(confirm.error) ? (
                <p className="mt-2 text-sm text-error">{mutationError(confirm.error)}</p>
              ) : null}
              <Button
                className="mt-4"
                type="submit"
                isLoading={confirmForm.formState.isSubmitting || confirm.isPending}
              >
                Confirm activation
              </Button>
            </li>
          </ol>
        </form>
      ) : null}

      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable 2FA">
        <form onSubmit={onDisable} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Tani waxay ka saaraysaa xaqiijinta laba-tallaabo. Geli koodhka authenticator-ka ama
            koodh kayd.
          </p>
          <Input
            label="Koodhka xaqiijinta"
            autoComplete="one-time-code"
            error={disableForm.formState.errors.code?.message}
            {...disableForm.register('code')}
          />
          {mutationError(disable.error) ? (
            <p className="text-sm text-error">{mutationError(disable.error)}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={disable.isPending}>
              Disable 2FA
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage authenticator">
        <form onSubmit={onRegenerate} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Soo saar koodhyo kayd cusub. Koodhyadii hore waa la burinayaa.
          </p>
          <Input
            label="Koodhka 6-lambar"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={manageForm.formState.errors.code?.message}
            {...manageForm.register('code')}
          />
          {mutationError(regenerate.error) ? (
            <p className="text-sm text-error">{mutationError(regenerate.error)}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={regenerate.isPending}>
              Regenerate backup codes
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
