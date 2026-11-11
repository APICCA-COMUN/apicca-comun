// RF-13 (021) · 13.1–13.7, RF-1 (015), RF-2 (015), D-10 (021), D-T24 (021): el menú de juego. El botón «Menú» abre un
// diálogo con los destinos de D-10 (021) (Jugar, Cómo se juega, Reglas, Plaza), «Facilitación» para quien facilita, lo que
// toca a la cuenta (nombre de usuario, rol, «Archivados» y «Cerrar sesión», o «Entrar» y «Unirme») y el apoyo. Elegir un
// destino lo cierra; Esc y «Cerrar» también, y el foco vuelve al botón. «Jugar» es la sección vigente en el mapa y en
// sus paneles. «Ver la bienvenida» vuelve a mostrar la invitación (RF-21 (021) · 21.4).
import { useId, useState } from 'react';
import { MAIN_MENU, isCurrentSection } from '../../shared/domain/navigation';
import { Link, isMapPage, matchRoute, navigate, useRoute } from '../app/router';
import { forgetWelcome } from '../app/welcome';
import { useSession, useSignOut } from '../app/session';
import { Dialog } from './Dialog';
import { roleLabel } from './SessionEntry';
import { SupportCredit } from './SupportCredit';
import './GameMenu.css';

function isCurrent(href: string, path: string): boolean {
  return href === '/' ? isMapPage(matchRoute(path).page) : isCurrentSection(href, path);
}

export function GameMenu() {
  const session = useSession();
  const signOut = useSignOut();
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => setOpen(false);

  // Primero al mapa, para que ninguna guarda de sesión devuelva a `/entrar` al cerrar (D-T13 (003)).
  const leave = () => {
    close();
    navigate('/');
    void signOut();
  };

  return (
    <>
      <button type="button" className="block action-secondary game-menu__toggle" aria-haspopup="dialog" onClick={() => setOpen(true)}>
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
        <nav aria-label="Principal" className="game-menu__nav">
          {MAIN_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="menu-link game-menu__link"
              onClick={close}
              {...(isCurrent(item.href, path) ? { 'aria-current': 'page' as const } : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {/* RF-21 (021) · 21.4, D-T37 (021): fuera de «Principal», que lleva solo los destinos de D-10 (021); vuelve a mostrar la
            invitación sobre el mapa. */}
        <Link
          href="/?bienvenida=1"
          className="menu-link game-menu__link game-menu__welcome"
          onClick={() => {
            forgetWelcome();
            close();
          }}
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
