// RF-1 (002) · 1.1, RF-10 (002) · 10.1, RF-7 (003) · 7.1–7.7, 7.10 (D-27 (003)) y RF-4 (008) · 4.1–4.6 (D-T4 (008) y D-T5 (008)): cabecera única del sitio, fuera de
// `<main>` (D-T16 (002)), con el logo, el menú principal, el conmutador de tema y, después, la entrada de la sesión
// (RF-3 (005)). Sin sombra ni recuadro; se ajusta en varias líneas a 360 px y al 200 %.
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { Logo } from './Logo';
import { SiteNav } from './SiteNav';
import { ThemeToggle } from './ThemeToggle';
import './SiteHeader.css';

/** Silueta genérica de persona para la cuenta suspendida (sin nombre de usuario, RF-11 (003) · 11.9). */
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" focusable="false" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 C4 16.5 7.5 14 12 14 C16.5 14 20 16.5 20 21 Z" />
    </svg>
  );
}

function SessionEntry() {
  const session = useSession();
  if (session.status === 'person') {
    return (
      <Link href="/tablero" className="account-initial" aria-label={`Mi tablero, @${session.username}`}>
        {session.username.charAt(0).toUpperCase()}
      </Link>
    );
  }
  if (session.status === 'suspended') {
    return (
      <Link href="/tablero" className="block icon-button" aria-label="Mi tablero, cuenta suspendida">
        <PersonGlyph />
      </Link>
    );
  }
  if (session.status === 'visitor') {
    return (
      <Link href="/entrar" className="block action-secondary">
        Entrar
      </Link>
    );
  }
  return null;
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo />
        <SiteNav />
        <div className="site-header__actions">
          <ThemeToggle />
          <SessionEntry />
        </div>
      </div>
    </header>
  );
}
