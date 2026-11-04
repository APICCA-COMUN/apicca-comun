// RF-7 (003) · 7.2, 7.3, 7.4 y RF-21 (019), D-12 (019), D-T14 (019) · Menú principal de la cabecera: renderiza MAIN_MENU,
// muestra «Mi tablero» solo con sesión de persona o facilitador y marca la sección vigente con `aria-current="page"`
// (D-T10 (003)). Por debajo de 1024 px los destinos quedan tras el botón «Menú» (`aria-expanded`, `aria-controls`);
// la lista empuja el contenido, Esc la cierra y devuelve el foco al botón, y elegir un destino también la cierra.
// Los enlaces siempre están en el DOM: es el CSS el que los oculta con la lista cerrada.
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { MAIN_MENU, isCurrentSection } from '../../shared/domain/navigation';
import { Link, useRoute } from '../app/router';
import { isSignedIn, useSession } from '../app/session';
import './SiteNav.css';

export function SiteNav() {
  const session = useSession();
  const { path } = useRoute();
  const signedIn = isSignedIn(session);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }
  };

  return (
    <nav aria-label="Principal" className="site-nav" data-open={open ? 'true' : 'false'} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="block site-nav__toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        Menú
      </button>
      <div id={listId} className="site-nav__list">
        {MAIN_MENU.filter((item) => signedIn || !item.requiresSession).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="menu-link"
            onClick={() => setOpen(false)}
            {...(isCurrentSection(item.href, path) ? { 'aria-current': 'page' as const } : {})}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
