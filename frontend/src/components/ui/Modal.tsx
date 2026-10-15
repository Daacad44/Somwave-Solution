import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  wide?: boolean;
  children: ReactNode;
}

// Accessible dialog: Escape closes, scrim click closes, labelled by its title.
export function Modal({ open, onClose, title, wide = false, children }: ModalProps): ReactNode {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-overlay absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-lg bg-surface p-6 shadow-lg ${wide ? 'max-w-3xl' : 'max-w-md'}`}
      >
        {title ? <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
