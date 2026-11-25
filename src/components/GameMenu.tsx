// RF-13 (021) · 13.1–13.7, RF-1 (015), RF-2 (015), D-T24 (021): el menú plegado de la cabecera. El botón «Menú» abre un
// diálogo con las cinco entradas de la navegación principal (Ápices, Acciones Comunes, Documentación, Constitución,
// Foro), «Facilitación» para quien facilita, lo que toca a la cuenta (nombre de usuario, rol, «Archivados» y «Cerrar
// sesión», o «Entrar» y «Unirme») y el apoyo. Elegir un destino lo cierra; Esc y «Cerrar» también, y el foco vuelve al
// botón. «Ápices» es la entrada vigente en el mapa y en sus paneles. «Ver la bienvenida» vuelve a mostrar la
// invitación (RF-21 (021) · 21.4): la marca se borra solo si la navegación ocurre (con cambios sin guardar, tras descartar). Desde 1100 px la cabecera ya muestra las cinco entradas y el menú solo lleva lo demás.
import { useId, useState } from 'react';
import { MAIN_MENU } from '../../shared/domain/navigation';
import { isCurrentEntry } from '../app/currentSection';
import { Link, navigate, useRoute } from '../app/router';
import { forgetWelcome } from '../app/welcome';
import { useSession, useSignOut } from '../app/session';
import { Dialog } from './Dialog';
import { roleLabel } from './SessionEntry';
import { SupportCredit } from './SupportCredit';
import './GameMenu.css';

export function GameMenu() {
  const session = useSession();
  const signOut = useSignOut();
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => setOpen(false);

  // Primero al mapa, para que ninguna guarda de sesión devuelva a `/entrar` al cerrar (D-T13 (003)). La sesión se cierra
  // solo cuando la navegación ocurre: con un borrador sin guardar, el guardián pregunta y, si la persona sigue editando, no
  // se cierra nada; si descarta, `navigate` corre `onNavigated` tras cambiar la dirección.
  const leave = () => {
    close();
    navigate('/', { onNavigated: () => void signOut() });
  };

  return (
    <>
      <button type="button" className="c-enlace action-secondary game-menu__toggle" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Menú
      </button>
      <Dialog open={open} labelledBy={titleId} onClose={close} className="game-menu">
        <div className="game-menu__head">
          <h2 id={titleId} className="game-menu__title">
            Menú
          </h2>
          <button type="button" className="block action-secondary" onClick={close}>
            Cerrar
          </button>
        </div>
        <nav aria-label="Secciones" className="game-menu__nav">
          {MAIN_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="menu-link game-menu__link"
              onClick={close}
              {...(isCurrentEntry(item.href, path) ? { 'aria-current': 'page' as const } : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {/* RF-21 (021) · 21.4, D-T37 (021): fuera de «Secciones», que lleva solo las entradas de la navegación principal; vuelve a mostrar la
            invitación sobre el mapa. */}
        <Link
          href="/?bienvenida=1"
          className="menu-link game-menu__link game-menu__welcome"
          onClick={close}
          onNavigated={forgetWelcome}
        >
          Ver la bienvenida
        </Link>
        <div className="game-menu__account">
          {session.status === 'person' && (
            <>
              <p className="game-menu__who">
                <span className="game-menu__name">@{session.username}</span>
                <span className="game-menu__role">{roleLabel(session.role)}</span>
              </p>
              {session.role === 'facilitator' && (
                <Link href="/facilitacion/invitaciones" className="menu-link game-menu__link" onClick={close}>
                  Facilitación
                </Link>
              )}
              <Link href="/archivados" className="menu-link game-menu__link" onClick={close}>
                Archivados
              </Link>
            </>
          )}
          {session.status === 'visitor' && (
            <div className="game-menu__actions">
              <Link href="/entrar" className="block action-secondary" onClick={close}>
                Entrar
              </Link>
              <Link href="/solicitar" className="block action-primary" onClick={close}>
                Unirme
              </Link>
            </div>
          )}
          {(session.status === 'person' || session.status === 'suspended') && (
            <div className="game-menu__actions">
              <button type="button" className="block action-secondary" onClick={leave}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
        <SupportCredit prefix="game-menu" />
      </Dialog>
    </>
  );
}
