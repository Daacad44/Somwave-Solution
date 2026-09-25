import { type ReactNode, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Copy, Download, Shield } from 'lucide-react';
import { confirmTwoFactorSchema, type ConfirmTwoFactorInput } from '@somwave/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ApiError } from '../../lib/apiClient';
import { qrSvgPath } from '../../lib/qr';
import {
  useConfirmTwoFactor,
  useCurrentUser,
  useDisableTwoFactor,
  useRegenerateBackupCodes,
  useStartTwoFactor,
} from '../auth/hooks';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

function mutationError(...errors: unknown[]): string | null {
  for (const error of errors) {
    if (error instanceof ApiError) return error.message;
    if (error) return 'Wax baa qaldamay';
  }
  return null;
}

function QrCode({ value }: { value: string }): ReactNode {
  const encoded = useMemo(() => qrSvgPath(value), [value]);
  if (!encoded) {
    return (
      <p className="rounded-lg border border-border bg-canvas p-4 text-sm text-muted">
        QR lama sameyn karin. Isticmaal sirta gacanta ee tallaabada xigta.
      </p>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${encoded.size} ${encoded.size}`}
      className="h-48 w-48 rounded-lg border border-border bg-surface p-2"
      role="img"
      aria-label="QR code for authenticator setup"
    >
      <path d={encoded.path} fill="currentColor" className="text-ink" />
    </svg>
  );
}

function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}): ReactNode {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
  };

  const download = (): void => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'somwave-2fa-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-ink">Koodhyada kaydka</h3>
      <p className="mt-2 text-sm text-muted">
        Kaydi koodhyadan meel ammaan ah. Mid kasta hal mar ayaa la isticmaali karaa. Lama soo
        bandhigi doono mar kale.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm text-ink">
        {codes.map((code) => (
          <li key={code} className="rounded-md border border-border bg-canvas px-3 py-2">
            {code}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
        <Button type="button" variant="secondary" onClick={download}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download codes
        </Button>
        <Button type="button" onClick={onDone}>
          I&apos;ve saved my codes
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorPanel(): ReactNode {
  const { data: user } = useCurrentUser();
  const start = useStartTwoFactor();
  const confirm = useConfirmTwoFactor();
  const disable = useDisableTwoFactor();
  const regenerate = useRegenerateBackupCodes();
  const [setup, setSetup] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const confirmForm = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });
  const disableForm = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });
  const regenForm = useForm<ConfirmTwoFactorInput>({
    resolver: zodResolver(confirmTwoFactorSchema),
    defaultValues: { code: '' },
  });

  const error = mutationError(start.error, confirm.error, disable.error, regenerate.error);

  const onStart = async (): Promise<void> => {
    const result = await start.mutateAsync();
    setSetup(result);
    setStep(2);
  };

  const onConfirm = confirmForm.handleSubmit(async (values) => {
    setStep(5);
    const result = await confirm.mutateAsync(values);
    setBackupCodes(result.backupCodes);
    setSetup(null);
    setStep(6);
  });

  const onDisable = disableForm.handleSubmit(async (values) => {
    await disable.mutateAsync(values);
    setDisableOpen(false);
    setManageOpen(false);
    disableForm.reset();
  });

  const onRegenerate = regenForm.handleSubmit(async (values) => {
    const result = await regenerate.mutateAsync(values);
    setBackupCodes(result.backupCodes);
    setRegenOpen(false);
    setManageOpen(false);
    setStep(6);
    regenForm.reset();
  });

  if (backupCodes && step === 6) {
    return (
      <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <BackupCodes
          codes={backupCodes}
          onDone={() => {
            setBackupCodes(null);
            setStep(1);
          }}
        />
      </article>
    );
  }

  if (user?.twoFactorEnabled) {
    return (
      <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Two-Factor Authentication</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Ku xooji akoonkaaga xaqiijin laba-tallaabo ah si aad uga ilaaliso gelitaanka aan la
              oggolayn.
            </p>
          </div>
          <Badge tone="success">Enabled</Badge>
        </div>
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Two-factor authentication is enabled
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setManageOpen(true)}>
            Manage 2FA
          </Button>
          <Button type="button" variant="danger" onClick={() => setDisableOpen(true)}>
            Disable 2FA
          </Button>
        </div>
        {user.twoFactorRequired ? (
          <p className="mt-3 text-sm text-warning">
            Doorkaaga wuxuu u baahan yahay 2FA. Haddii aad dami doonto, waxaa lagaa weydiin doonaa
            inaad dib u shiddo.
          </p>
        ) : null}

        <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage authenticator">
          <div className="flex flex-col gap-3">
            <Button type="button" variant="secondary" onClick={() => setRegenOpen(true)}>
              Regenerate backup codes
            </Button>
            <Button type="button" variant="danger" onClick={() => setDisableOpen(true)}>
              Disable 2FA
            </Button>
          </div>
        </Modal>

        <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable 2FA">
          <form onSubmit={onDisable} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Geli koodhka 6-lambar si aad u xaqiijiso inaad rabto inaad 2FA dami doonto.
            </p>
            <Input
              label="Koodhka 6-lambar"
              inputMode="numeric"
              autoComplete="one-time-code"
              error={disableForm.formState.errors.code?.message}
              {...disableForm.register('code')}
            />
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setDisableOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={disable.isPending}>
                Disable 2FA
              </Button>
            </div>
          </form>
        </Modal>

        <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="Regenerate backup codes">
          <form onSubmit={onRegenerate} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Koodhyada hore waa la burinayaa. Geli koodhka authenticator-ka.
            </p>
            <Input
              label="Koodhka 6-lambar"
              inputMode="numeric"
              autoComplete="one-time-code"
              error={regenForm.formState.errors.code?.message}
              {...regenForm.register('code')}
            />
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setRegenOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={regenerate.isPending}>
                Generate new codes
              </Button>
            </div>
          </form>
        </Modal>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Two-Factor Authentication</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Ku xooji akoonkaaga xaqiijin laba-tallaabo ah si aad uga ilaaliso gelitaanka aan la
            oggolayn.
          </p>
        </div>
        <Badge tone="warning">Not enabled</Badge>
      </div>

      <ol className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-muted" aria-label="Setup steps">
        {['Enable', 'QR code', 'Secret', 'Verify', 'Confirm', 'Backup codes'].map((label, index) => (
          <li
            key={label}
            className={
              step === index + 1 ? 'rounded-full bg-brand-soft px-2 py-1 text-brand' : 'px-2 py-1'
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="mt-6">
          <p className="flex items-start gap-2 text-sm text-muted">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            Ku dar sirta app-ka Google Authenticator ama mid la mid ah, kadib geli koodhka.
          </p>
          {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
          <Button className="mt-4" onClick={onStart} isLoading={start.isPending}>
            Enable 2FA
          </Button>
        </div>
      ) : null}

      {setup && step === 2 ? (
        <div className="mt-6 flex flex-col gap-4">
          <h3 className="text-base font-semibold text-ink">Scan the QR code</h3>
          <QrCode value={setup.otpauthUrl} />
          <Button type="button" onClick={() => setStep(3)}>
            Continue
          </Button>
        </div>
      ) : null}

      {setup && step === 3 ? (
        <div className="mt-6 flex flex-col gap-4">
          <h3 className="text-base font-semibold text-ink">Manual setup</h3>
          <p className="text-sm text-muted">Haddii QR-ku shaqeyn waayo, geli sirta gacanta:</p>
          <p className="break-all rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-sm text-ink">
            {setup.secret}
          </p>
          <Button type="button" variant="secondary" onClick={() => setStep(4)}>
            Enter verification code
          </Button>
        </div>
      ) : null}

      {setup && (step === 4 || step === 5) ? (
        <form onSubmit={onConfirm} className="mt-6 flex max-w-md flex-col gap-4" noValidate>
          <h3 className="text-base font-semibold text-ink">
            {step === 5 ? 'Confirm activation' : 'Enter 6-digit verification code'}
          </h3>
          <Input
            label="Koodhka 6-lambar"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={confirmForm.formState.errors.code?.message}
            {...confirmForm.register('code')}
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" isLoading={confirmForm.formState.isSubmitting || confirm.isPending}>
            Confirm activation
          </Button>
        </form>
      ) : null}
    </article>
  );
}
