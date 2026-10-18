// Finance requires a session that proved 2FA. Instead of telling the user to
// sign out and back in, this asks for a current code and upgrades the session.
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../lib/apiClient';
import { stepUpTwoFactor } from '../auth/api';

export type FinanceAccessReason = 'FINANCE_MFA_STEP_UP_REQUIRED' | 'FINANCE_2FA_NOT_ENROLLED';

/** Reads the finance access reason from an API error, if it is one. */
export function financeAccessReason(error: unknown): FinanceAccessReason | null {
  if (!(error instanceof ApiError) || error.code !== 'FORBIDDEN') return null;
  const reason = (error.details as { reason?: unknown } | undefined)?.reason;
  return reason === 'FINANCE_MFA_STEP_UP_REQUIRED' || reason === 'FINANCE_2FA_NOT_ENROLLED'
    ? reason
    : null;
}

export function FinanceStepUp({ reason }: { reason: FinanceAccessReason }): ReactNode {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const stepUp = useMutation({
    mutationFn: () => stepUpTwoFactor({ code: code.trim() }),
    onSuccess: async () => {
      setCode('');
      await queryClient.invalidateQueries();
    },
  });

  if (reason === 'FINANCE_2FA_NOT_ENROLLED') {
    return (
      <section className="rounded-lg border border-border bg-surface p-6" aria-live="polite">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          Two-factor authentication required
        </h2>
        <p className="mt-2 text-sm text-muted">
          Financial records are only available to accounts protected by two-factor authentication.
        </p>
        <Link
          to="/profile?tab=security"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-surface"
        >
          Set up two-factor authentication
        </Link>
      </section>
    );
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (code.trim().length >= 6) stepUp.mutate();
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-6" aria-live="polite">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        Confirm it's you
      </h2>
      <p className="mt-2 text-sm text-muted">
        Enter the 6-digit code from your authenticator app (or a backup code) to open finance.
      </p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={submit}>
        <Input
          label="Two-factor code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={
            stepUp.error
              ? stepUp.error instanceof ApiError
                ? stepUp.error.message
                : 'Could not verify the code. Try again.'
              : undefined
          }
        />
        <Button type="submit" disabled={stepUp.isPending || code.trim().length < 6}>
          {stepUp.isPending ? 'Verifying…' : 'Verify'}
        </Button>
      </form>
    </section>
  );
}
