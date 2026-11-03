import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, subtitle, children, onClose, wide = false }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const getFocusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(el => el.getClientRects().length > 0);
    const initialFocus = dialog.current?.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusable()[0] ?? dialog.current;
    initialFocus?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.current?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return createPortal(
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? subtitleId : undefined} ref={dialog} tabIndex={-1}>
        <header className="modal-header">
          <div><h2 id={titleId}>{title}</h2>{subtitle && <p id={subtitleId}>{subtitle}</p>}</div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={21} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
