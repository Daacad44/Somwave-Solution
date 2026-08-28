import { type HTMLAttributes, type TableHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Styled table primitives. The container scrolls horizontally so wide tables
// never break the page layout (SYSTEM_PROMPT §12). Feature-level search / filter
// / pagination sit in the feature that uses these.
export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-start', className)} {...props} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-border', className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('px-3 py-2 text-start text-sm font-semibold text-muted', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2 text-base text-ink', className)} {...props} />;
}
