// RF-1 (001), RF-4 (001), RF-5 (001), RF-6 (002) · 6.1, 6.3, RF-7 (003) · 7.9,
// RF-13 (019) · 13.1, 13.2, D-T7 (019), RF-18 (019) · 18.1, D-T12 (019) · Armazón común de las páginas de facilitación:
// solo para quien facilita, navegación entre ellas, listas sin viñeta con filas como bloques, enlace abreviado con
// acción de copiar al portapapeles y un solo h1 por página, también sin permiso (RF-2 (024) · 2.1, D-T2 (024)); sin sesión ofrece
// entrar y volver a la página (RF-9 (024) · 9.1, 9.2, D-T12 (024)).
import { useEffect, useState, type ReactNode } from 'react';
import { FACILITATION_MENU, isCurrentSection } from '../../shared/domain/navigation';
import { Link, useRoute } from '../app/router';
import { useSession, type PersonSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { SignInLink } from '../components/SignInLink';
import { ApiClientError } from '../data/api';
import './Facilitation.css';

const AREA = 'Facilitación';

/** Mensaje en español de un error del servidor; uno que no sea tipificado cae en el genérico. */
export function errorText(error: unknown): string {
  return error instanceof ApiClientError ? error.message : 'No se pudo completar la acción. Inténtalo de nuevo.';
}

/** El servidor devuelve la ruta (`/registro/<token>`); la persona necesita la URL completa para compartirla. */
export const absoluteLink = (path: string): string =>
  path.startsWith('http://') || path.startsWith('https://') ? path : `${window.location.origin}${path}`;

/** Muestra la ruta sin el origen; para tokens largos abrevia con «…» para no desbordar en pantallas angostas. */
export function shortenLink(path: string): string {
  const prefix = '/registro/';
  if (path.startsWith(prefix)) {
    const token = path.slice(prefix.length);
    if (token.length > 12) {
      return `${prefix}…${token.slice(-6)}`;
    }
  }
  return path;
}

export function FacilitationShell({ title, children }: { title: string; children: (session: PersonSession) => ReactNode }) {
  usePageTitle({ area: AREA, contentTitle: title });
  const session = useSession();
  const { path } = useRoute();
  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status !== 'person' || session.role !== 'facilitator') {
    const visitor = session.status === 'visitor';
    return (
      <section>
        <h1>{title}</h1>
        <p>{visitor ? 'Esta página es solo para quienes facilitan. Entra con tu cuenta para verla.' : 'Esta página es solo para quienes facilitan.'}</p>
        {visitor ? <SignInLink /> : null}
      </section>
    );
  }
  return (
    <section className="facilitation">
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
      <h1>{title}</h1>
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

/** Enlace de invitación abreviado, con botón para copiar el enlace completo (RF-13 (019) · 13.2, D-T7 (019)). */
export function LinkBox({ path }: { path: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  // Cada intento monta un aviso nuevo, para que el lector lo anuncie también la segunda vez (RNF-1 (019)).
  const [attempt, setAttempt] = useState(0);
  const url = absoluteLink(path);
  const abbreviated = shortenLink(path);

  const copy = async () => {
    setAttempt((count) => count + 1);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard no disponible');
      }
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <span className="link-box">
      <code>{abbreviated}</code>{' '}
      <button type="button" className="block action-secondary" onClick={() => void copy()}>
        Copiar enlace
      </button>
      {copyState === 'idle' ? null : (
        <span key={attempt} role="status" className="link-box__status">
          {copyState === 'copied' ? 'Enlace copiado.' : 'No se pudo copiar automáticamente. Copia el enlace a mano:'}
        </span>
      )}
      {copyState === 'failed' ? (
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Enlace completo de la invitación"
          className="block link-box__manual"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </span>
  );
}
