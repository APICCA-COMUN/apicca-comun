// RF-14 (021) · 14.1, 14.7–14.9, D-T23 (021): el panel que se abre sobre el mapa con la ficha, «Construir ápice» o
// «Editar ápice». Es una región complementaria con nombre; trae «Ampliar»/«Reducir» y «Cerrar». Con `autoFocus`, al
// abrirse lleva el foco a su título apenas aparece (la ficha puede tardar en cargar); sin él, no lo mueve. Un aviso
// (`notice`, el de cambios sin guardar) va arriba del contenido. RNF-1 (021): Escape lo cierra, salvo que un control de
// adentro ya lo haya atendido, y `onExpand` avisa cuando cubre todo el mapa, para que quien lo pinta saque lo tapado del
// orden del teclado.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import './GamePanel.css';

export interface GamePanelProps {
  label: string;
  onClose: () => void;
  autoFocus?: boolean;
  notice?: ReactNode;
  /** Se llama con `true` al ampliarse y con `false` al reducirse o desmontarse. */
  onExpand?: (expanded: boolean) => void;
  children: ReactNode;
}

function focusHeading(body: HTMLElement): boolean {
  const heading = body.querySelector<HTMLElement>('h1');
  if (heading === null) return false;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
  return true;
}

export function GamePanel({ label, onClose, autoFocus = false, notice, onExpand, children }: GamePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const expandListener = useRef(onExpand);
  expandListener.current = onExpand;

  useEffect(() => {
    expandListener.current?.(expanded);
  }, [expanded]);
  useEffect(() => () => expandListener.current?.(false), []);

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
    <aside className="game-panel" aria-label={label} data-expanded={expanded ? 'true' : 'false'} onKeyDown={onKeyDown}>
      <div className="game-panel__bar">
        <button type="button" className="block action-secondary game-panel__size" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Reducir' : 'Ampliar'}
        </button>
        <button type="button" className="block action-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div ref={body} className="game-panel__body">
        {notice}
        {children}
      </div>
    </aside>
  );
}
