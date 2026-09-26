import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, name, className, trailing, ...props },
  ref,
) {
  const inputId = id ?? name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'h-11 w-full rounded-md border bg-surface px-3 text-base text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            error ? 'border-error' : 'border-border',
            trailing ? 'pe-12' : null,
            className,
          )}
          {...props}
        />
        {trailing ? (
          <div className="absolute end-1 top-1/2 -translate-y-1/2">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
