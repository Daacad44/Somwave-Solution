import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

// Solid border + coloured text (no alpha), so it stays on-token and readable.
// warning uses accent-600 which is AA-safe at small text on white (§8).
const TONES: Record<Tone, string> = {
  neutral: 'border-border text-muted',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  error: 'border-error text-error',
  info: 'border-info text-info',
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border bg-surface px-2 py-0.5 text-sm font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
