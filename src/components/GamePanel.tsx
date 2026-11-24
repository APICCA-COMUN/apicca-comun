// RF-14 (021) · 14.1, 14.8, 14.9, D-T23 (021): el panel de Inicio con la ficha, «Prototipar un Ápice», «Editar ápice», el
// boceto, «Conectar» o una Acción Común. Es una región complementaria con nombre que ocupa el lugar del contenido por
// defecto del panel de la derecha, y trae «Cerrar» (el ícono de cerrar en un botón de 44 px). Con `autoFocus`, al abrirse
// lleva el foco a su título apenas aparece (la ficha puede tardar en cargar); sin él, no lo mueve. Un aviso (`notice`, el de
// cambios sin guardar) va arriba del contenido. RNF-1 (021): Escape lo cierra, salvo que un control de adentro ya lo haya
// atendido. Con `embedded`, el panel va dentro de la columna de Inicio, debajo de su cabecera (la ficha del Ápice): no se
// desplaza por su cuenta, lo hace la columna, y al abrirse lleva la ficha a la vista si no se ve.
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icono } from './Glifo';
import './GamePanel.css';

export interface GamePanelProps {
  label: string;
  onClose: () => void;
  autoFocus?: boolean;
  notice?: ReactNode;
  /** Dentro de la columna de Inicio, bajo su cabecera, en vez de ocupar toda la columna. */
  embedded?: boolean;
  children: ReactNode;
}

function focusHeading(body: HTMLElement): boolean {
  const heading = body.querySelector<HTMLElement>('h1');
  if (heading === null) return false;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
  return true;
}

export function GamePanel({ label, onClose, autoFocus = false, notice, embedded = false, children }: GamePanelProps) {
  const body = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);

  // En un teléfono (menos de 900 px) el panel va debajo del mapa, fuera de la ventana: al abrirse, la página baja hasta él.
  // Se espera un cuadro para que el desplazamiento al inicio que hace la ruta al navegar no lo deshaga.
  // Embebido en un escritorio, la columna de Inicio es la que se desplaza: si la ficha no se ve (se abrió desde la lista, al
  // final de la columna), la columna baja o sube hasta ella; si ya se ve, no se mueve.
  useEffect(() => {
    const element = panel.current;
    if (element === null || typeof window.matchMedia !== 'function') return;
    const phone = window.matchMedia('(max-width: 899.98px)').matches;
    if (!phone && !embedded) return;
    const frame = requestAnimationFrame(() => {
      if (typeof element.scrollIntoView !== 'function') return;
      if (!phone) {
        const column = element.closest<HTMLElement>('.play__home');
        if (column === null) return;
        const { top } = element.getBoundingClientRect();
        const box = column.getBoundingClientRect();
        if (top >= box.top && top < box.bottom - 48) return;
      }
      element.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [embedded]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onClose();
  };

  useEffect(() => {
    const element = body.current;
    if (!autoFocus || element === null || focusHeading(element)) return;
    const observer = new MutationObserver(() => {
      if (focusHeading(element)) observer.disconnect();
    });
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [autoFocus]);

  return (
    <aside ref={panel} className={embedded ? 'game-panel game-panel--embedded' : 'game-panel'} aria-label={label} onKeyDown={onKeyDown}>
      <div className="game-panel__bar">
        <button type="button" className="block icon-button" aria-label="Cerrar" title="Cerrar" onClick={onClose}>
          <Icono name="cerrar" />
        </button>
      </div>
      <div ref={body} className="game-panel__body">
        {notice}
        {children}
      </div>
    </aside>
  );
}
