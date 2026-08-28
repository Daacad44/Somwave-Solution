import { type ReactNode } from 'react';
import { Skeleton } from '../ui/Skeleton';

// Skeletons shaped like content — never a bare spinner on a blank page (§12).
export function LoadingState({
  rows = 3,
  label = 'Loading',
}: {
  rows?: number;
  label?: string;
}): ReactNode {
  return (
    <div className="flex flex-col gap-3 p-4" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_row, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}
