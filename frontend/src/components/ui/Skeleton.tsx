import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

// Shape it like the content it stands in for (SYSTEM_PROMPT §12) via className.
export function Skeleton({ className }: { className?: string }): ReactNode {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-alt', className)} />
  );
}
