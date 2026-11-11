// RF-1 (002) · 1.1, RF-10 (002) · 10.1, RF-7 (003) · 7.1, 7.5–7.7, 7.10 (D-27 (003)), RF-4 (008) · 4.1–4.6 y RF-16 (021) ·
// 16.2, D-T24 (021): cabecera delgada de las páginas de texto, fuera de `<main>` (D-T16 (002)). Lleva el logo, «Volver al
// mapa», el conmutador de tema, la cuenta (RF-3 (005)) y «Menú»; los destinos están en el menú de juego. Sin sombra ni
// recuadro; cabe en una fila desde 360 px y se ajusta al 200 %. Las páginas del mapa no la pintan: tienen su barra.
import { Link } from '../app/router';
import { GameMenu } from './GameMenu';
import { Logo } from './Logo';
import { SessionEntry } from './SessionEntry';
import { ThemeToggle } from './ThemeToggle';
import './SiteHeader.css';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo />
        <Link href="/" className="block action-secondary site-header__back">
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" focusable="false">
            <path d="M14 6 L8 12 L14 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="site-header__back-text">Volver al mapa</span>
        </Link>
        <div className="site-header__actions">
          <ThemeToggle />
          <SessionEntry />
          <GameMenu />
        </div>
      </div>
    </header>
  );
}
