import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

// The original Somwave Solution wordmark. Rendered as the supplied image only:
// no crop, no recolor, no filter, and the file's own aspect ratio.
export function BrandLogo({ className }: { className?: string }): ReactNode {
  return (
    <img
      src="/brand/somwave-solution-logo.png"
      alt="Somwave Solution"
      width={2000}
      height={667}
      className={cn('h-auto max-w-full object-contain', className)}
    />
  );
}
