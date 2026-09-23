import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

// Official wordmark. The source canvas is mostly empty, so the frame zooms to
// the mark the same way the public site does. `inverted` is for the navy sidebar.
export function BrandLogo({
  className,
  inverted = false,
  mark = false,
}: {
  className?: string;
  inverted?: boolean;
  mark?: boolean;
}): ReactNode {
  return (
    <span className={cn('brand-logo', mark ? 'brand-logo-mark' : 'brand-logo-word', className)}>
      <img
        src="/brand/somwave-logo.png"
        alt="Somwave Solution"
        className={cn('brand-logo-img', inverted && 'brand-logo-invert')}
      />
    </span>
  );
}
