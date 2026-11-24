// RF-1 (002) · 1.1, RF-7 (003) · 7.1, RF-4 (008) · 4.1–4.6, RF-16 (021) · 16.2: la cabecera del sitio, con el logo, el tema y «Menú».
// Sistema «APICCA · Mapa» (`.ap-cabecera`): la cabecera de todo el sitio, también la de Inicio (la monta `Play`). 64 px
// de alto con borde inferior de 3 px en tinta, sobre papel: el logo, la navegación principal en mayúsculas con la
// entrada vigente subrayada, y a la derecha el tema, la campana de avisos (con sesión), «Entrar» o la cuenta y «Menú».
// Por debajo de 1100 px la navegación se pliega en «Menú» (`GameMenu`), con las mismas cinco entradas. Los datos de
// los avisos entran por `noticesSource` y `client`, como en `NoticeBell` (las pruebas de `Play` los inyectan).
import { MAIN_MENU } from '../../shared/domain/navigation';
import { isCurrentEntry } from '../app/currentSection';
import { Link, useRoute } from '../app/router';
import type { ApiOps, OpClient } from '../data/api';
import type { NoticesSource } from '../data/notices';
import { GameMenu } from './GameMenu';
import { Logo } from './Logo';
import { NoticeBell } from './NoticeBell';
import { SessionEntry } from './SessionEntry';
import { ThemeToggle } from './ThemeToggle';
import './SiteHeader.css';

export interface SiteHeaderProps {
  /** Fuente de los avisos de la campana; por defecto, Firestore. */
  noticesSource?: NoticesSource;
  /** Cliente de las operaciones («Marcar como leídos»); por defecto, el de la API. */
  client?: OpClient<ApiOps>;
}

export function SiteHeader({ noticesSource, client }: SiteHeaderProps = {}) {
  const { path } = useRoute();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo />
        <nav aria-label="Principal" className="site-nav">
          {MAIN_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="menu-link site-nav__link"
              {...(isCurrentEntry(item.href, path) ? { 'aria-current': 'page' as const } : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <ThemeToggle />
          <NoticeBell {...(noticesSource === undefined ? {} : { source: noticesSource })} {...(client === undefined ? {} : { client })} />
          <SessionEntry />
          <GameMenu />
        </div>
      </div>
    </header>
  );
}
