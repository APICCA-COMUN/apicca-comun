// RF-14 (019), D-T8 (019) · Diálogo modal sobre el `<dialog>` nativo:
// - `showModal()` vuelve inerte el fondo y `::backdrop` lo vela con `veil` (Dialog.css); sin `showModal` (jsdom)
//   se usa el atributo `open`;
// - Tab y Mayús+Tab dan la vuelta dentro del diálogo; al cerrarse, el foco vuelve a quien lo tenía al abrirse;
// - el evento nativo `close`, venga de Esc, de un botón o del navegador, llega a React por `onClose`;
// - con `dismissible={false}` Esc no cierra (`cancel` llama a `preventDefault()`) y, si el navegador lo cierra
//   igual mientras `open` sigue en `true`, se vuelve a abrir;
// - los hijos siguen montados aunque esté cerrado: un formulario conserva lo escrito.
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  /** Id del encabezado que nombra el diálogo. */
  labelledBy: string;
  onClose: () => void;
  /** `false`: Esc y el navegador no lo cierran; solo lo cierra quien lo controla. */
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

function focusables(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.hasAttribute('disabled') && !element.hidden && element.getAttribute('tabindex') !== '-1',
  );
}

function openNative(dialog: HTMLDialogElement) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeNative(dialog: HTMLDialogElement) {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

export function Dialog({ open, labelledBy, onClose, dismissible = true, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /** Quien tenía el foco al abrirse. */
  const returnTo = useRef<HTMLElement | null>(null);
  /** El cierre lo pidió la propia prop `open`: su evento `close` no se reenvía. */
  const closingByProp = useRef(false);
  const latest = useRef({ open, dismissible, onClose });
  latest.current = { open, dismissible, onClose };

  const restoreFocus = () => {
    const target = returnTo.current;
    returnTo.current = null;
    if (target !== null && target.isConnected) target.focus();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      openNative(dialog);
    } else if (!open && dialog.open) {
      closingByProp.current = typeof dialog.close === 'function';
      closeNative(dialog);
      restoreFocus();
    }
  }, [open]);

  // Si el diálogo se desmonta abierto, el foco no se pierde en el `body`.
  // (En StrictMode el desmontaje simulado deja el elemento conectado: ahí no se hace nada.)
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      queueMicrotask(() => {
        if (dialog !== null && !dialog.isConnected) restoreFocus();
      });
    };
  }, []);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (!dismissible) event.preventDefault();
  };

  const handleClose = () => {
    if (closingByProp.current) {
      closingByProp.current = false;
      return;
    }
    const dialog = ref.current;
    const { open: stillOpen, dismissible: canDismiss, onClose: notify } = latest.current;
    if (!canDismiss && stillOpen && dialog !== null) {
      // El navegador lo cerró aunque no debía: se vuelve a abrir, con el foco dentro.
      openNative(dialog);
      return;
    }
    restoreFocus();
    notify();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const items = focusables(dialog);
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Mientras está abierto lleva el rol explícito: blocks.css (RF-4 (003) · 4.7) y los ayudantes de prueba lo buscan.
      role={open ? 'dialog' : undefined}
      // Cerrado, `hidden` lo deja fuera para quien cuenta lo visible (expectActions) además del `display: none` nativo.
      hidden={!open}
      className={['block', 'dialog', className].filter(Boolean).join(' ')}
      onCancel={handleCancel}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
    >
      {children}
    </dialog>
  );
}
