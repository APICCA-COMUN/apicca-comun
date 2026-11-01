// RF-1 (001), RF-4 (001), RF-5 (001), RF-6 (002) · 6.1, 6.3, RF-7 (003) · 7.9 · Armazón común de las páginas de facilitación: solo para quien facilita,
// navegación entre ellas, lectura de listas y el cuadro que muestra y copia un enlace de invitación.
import { useEffect, useState, type ReactNode } from 'react';
import { FACILITATION_MENU, isCurrentSection } from '../../shared/domain/navigation';
import { Link, useRoute } from '../app/router';
import { useSession, type PersonSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { ApiClientError } from '../data/api';
import '../components/SiteNav.css';

const AREA = 'Facilitación';

/** Mensaje en español de un error del servidor; uno que no sea tipificado cae en el genérico. */
export function errorText(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'No se pudo completar la acción. Inténtalo de nuevo.';
}

/** El servidor devuelve la ruta (`/registro/<token>`); la persona necesita la URL completa para compartirla. */
export const absoluteLink = (path: string): string => `${window.location.origin}${path}`;

export function FacilitationShell({ title, children }: { title: string; children: (session: PersonSession) => ReactNode }) {
  usePageTitle({ area: AREA, contentTitle: title });
  const session = useSession();
  const { path } = useRoute();
  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status !== 'person' || session.role !== 'facilitator') {
    return <p>Esta página es solo para quienes facilitan.</p>;
  }
  return (
    <section>
      <nav aria-label="Facilitación" className="site-nav">
        {FACILITATION_MENU.map((item) => (
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
      <h2>{title}</h2>
      {children(session)}
    </section>
  );
}

/** Lista que llega de la fuente; `rows` es `null` mientras carga y `failed` si la lectura falló. */
export function useRows<T>(subscribe: (callback: (rows: T[]) => void, onError: () => void) => () => void) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => subscribe(setRows, () => setFailed(true)), [subscribe]);
  return { rows, failed };
}

/** Enlace de invitación en claro, con botón para copiarlo. */
export function LinkBox({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = absoluteLink(path);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span>
      <code>{url}</code>{' '}
      <button type="button" className="block action-secondary" onClick={() => void copy()}>
        Copiar enlace
      </button>
      {copied ? <span> Enlace copiado.</span> : null}
    </span>
  );
}
