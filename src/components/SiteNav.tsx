// RF-7 (003) · 7.2, 7.3, 7.4 · Menú principal de la cabecera: renderiza MAIN_MENU, muestra «Mi tablero» solo con
// sesión de persona o facilitador y marca la sección vigente con `aria-current="page"` (D-T10 (003)).
import { MAIN_MENU, isCurrentSection } from '../../shared/domain/navigation';
import { Link, useRoute } from '../app/router';
import { isSignedIn, useSession } from '../app/session';
import './SiteNav.css';

export function SiteNav() {
  const session = useSession();
  const { path } = useRoute();
  const signedIn = isSignedIn(session);
  return (
    <nav aria-label="Principal" className="site-nav">
      {MAIN_MENU.filter((item) => signedIn || !item.requiresSession).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="menu-link"
          {...(isCurrentSection(item.href, path) ? { 'aria-current': 'page' as const } : {})}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
