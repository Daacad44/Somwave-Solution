import { useId, useState } from 'react';
import { passwordPolicyStatus } from '@somwave/shared';
import { Input } from '../../components/ui/Input';

export function NewPasswordFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
  email,
  name,
}: {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
  email?: string;
  name?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const status = passwordPolicyStatus(password, { email, name });
  const count = Object.values(status).filter(Boolean).length;
  return (
    <>
      <Input
        label="New password"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
        value={password}
        onChange={(event) => onPassword(event.target.value)}
        aria-describedby={id}
        trailing={
          <button
            type="button"
            aria-label={show ? 'Hide password' : 'Show password'}
            className="min-h-11 px-3 text-sm text-brand"
            onClick={() => setShow(!show)}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        }
      />
      <div id={id} className="rounded border border-border p-3 text-sm text-muted">
        <p className="font-medium text-ink">Password requirements</p>
        <ul className="mt-2 space-y-1">
          {(
            [
              ['length', 'Use 12 to 128 characters'],
              ['uppercase', 'Include an uppercase letter'],
              ['lowercase', 'Include a lowercase letter'],
              ['number', 'Include a number'],
              ['special', 'Include a special character'],
              ['uncommon', 'Avoid common passwords'],
              ['private', 'Avoid your name or email'],
            ] as const
          ).map(([key, label]) => (
            <li key={key}>
              {status[key] ? '✓' : '○'} {label}
            </li>
          ))}
        </ul>
        <p className="mt-2" role="status">
          Password strength:{' '}
          {!password ? 'Not set' : count < 5 ? 'Weak' : count < 7 ? 'Fair' : 'Strong'}
        </p>
      </div>
      <Input
        label="Confirm password"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        maxLength={128}
        required
        value={confirmation}
        error={confirmation && password !== confirmation ? 'Passwords do not match.' : undefined}
        onChange={(event) => onConfirmation(event.target.value)}
      />
    </>
  );
}
