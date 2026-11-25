// RF-14 (021) · 14.1, 14.8, 14.9, D-T23 (021): el panel de Inicio con la ficha, «Prototipar un Ápice», «Editar ápice», el
// boceto, «Conectar» o una Acción Común. Es una región complementaria con nombre que ocupa el lugar del contenido por
// defecto del panel de la derecha. «E3 · Celda» (24-11-2026): sin borde ni fondo propio; abre con la línea de sección
// (`.c-seccion`): el rótulo con el TIPO del panel («Ápice», «Acción Común») a la izquierda y «Cerrar» (texto + ícono, área de
// 44 px) a la derecha. El `label` es el nombre accesible de la región; `section` da el rótulo visible cuando difiere (así el h1 no
// repite el mismo texto de la línea de sección).
// Con `autoFocus`, al abrirse
// lleva el foco a su título apenas aparece (la ficha puede tardar en cargar); sin él, no lo mueve. Un aviso (`notice`, el de
// cambios sin guardar) va arriba del contenido; al aparecer, el panel (y la columna o la página, si hace falta) se desplaza hasta
// mostrarlo y el foco pasa a él, para que «Cerrar» no parezca no hacer nada (QA celda 2 · 4); con `prefers-reduced-motion`,
// sin animación; si el aviso se va y el foco quedó en el aire, vuelve a «Cerrar». RNF-1 (021): Escape lo cierra, salvo que un control de adentro ya lo haya
// atendido. Con `embedded`, el panel va dentro de la columna de Inicio, debajo de su cabecera (la ficha del Ápice): no se
// desplaza por su cuenta, lo hace la columna, y al abrirse lleva la ficha a la vista si no se ve.
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icono } from './Glifo';
import './GamePanel.css';

export interface GamePanelProps {
  /** El nombre accesible de la región. */
  label: string;
  /** El rótulo visible de la línea de sección (el tipo: «Ápice», «Acción Común»); sin él, el `label`. */
  section?: string;
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

export function GamePanel({ label, section = label, onClose, autoFocus = false, notice, embedded = false, children }: GamePanelProps) {
  const body = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const noticeBox = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const hasNotice = Boolean(notice);
  const hadNotice = useRef(false);

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
    // La ficha puede cargar después: mientras el panel es corto («Cargando…»), la página no llega a bajar hasta su comienzo
    // (el final del documento la frena). En un teléfono, cada vez que el panel crece se vuelve a llevar a la vista, hasta
    // que la persona toca o desplaza la página, o pasan dos segundos.
    let follow: ResizeObserver | undefined;
    let stop: (() => void) | undefined;
    if (phone && typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => {
        if (typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'start' });
      });
      follow = observer;
      const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
      const timer = window.setTimeout(() => stop?.(), 2000);
      stop = () => {
        window.clearTimeout(timer);
        observer.disconnect();
        for (const name of events) window.removeEventListener(name, stop!);
      };
      for (const name of events) window.addEventListener(name, stop, { passive: true });
      observer.observe(element);
    }
    return () => {
      cancelAnimationFrame(frame);
      stop?.();
      follow?.disconnect();
    };
  }, [embedded]);

  // QA celda 2 · 4: el aviso aparece arriba del cuerpo, que puede estar desplazado: se lleva a la vista y recibe el foco.
  useEffect(() => {
    const box = noticeBox.current;
    if (hasNotice && box !== null) {
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      box.focus({ preventScroll: true });
      if (typeof box.scrollIntoView === 'function') box.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    } else if (!hasNotice && hadNotice.current) {
      const active = document.activeElement;
      if (active === null || active === document.body) closeButton.current?.focus({ preventScroll: true });
    }
    hadNotice.current = hasNotice;
  }, [hasNotice]);

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
      <div className="game-panel__bar c-seccion">
        <span className="c-rot">{section}</span>
        <button ref={closeButton} type="button" className="game-panel__close c-rot" onClick={onClose}>
          Cerrar
          <Icono name="cerrar" size={12} />
        </button>
      </div>
      <div ref={body} className="game-panel__body">
        {hasNotice && (
          <div ref={noticeBox} tabIndex={-1} className="game-panel__notice">
            {notice}
          </div>
        )}
        {children}
      </div>
    </aside>
  );
}
