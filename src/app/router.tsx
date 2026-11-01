// Enrutador mínimo del sitio: una tabla de rutas, `matchRoute` para resolverlas sin DOM,
// `navigate`/`useRoute` sobre la History API y un `Link` interno. Aún no hay control de
// acceso: toda ruta es pública hasta que una spec defina quién puede abrir qué.
import { useEffect, useRef, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** Identificador de cada página, más la página no encontrada. */
export type PageId = 'home' | 'notFound' | 'login' | 'forgot' | 'action' | 'register' | 'registerInfo' | 'request' | 'facilitationInvitations' | 'facilitationEnrollments' | 'facilitationAccounts' | 'apiceHistory' | 'apiceNew' | 'apiceEdit' | 'archived' | 'apiceView' | 'prototyping' | 'dashboard' | 'documentation' | 'constitution' | 'constitutionHistory' | 'constitutionSection' | 'constitutionDocument' | 'amendments' | 'amendmentDetail' | 'forum' | 'forumThread';

export interface PageRoute {
  /** Patrón con segmentos literales y parámetros `:nombre`. */
  pattern: string;
  page: PageId;
}

/** Tabla de rutas, en orden de declaración (la primera que encaja gana). */
export const ROUTES: readonly PageRoute[] = [
  { pattern: '/', page: 'home' },
  { pattern: '/entrar', page: 'login' },
  { pattern: '/archivados', page: 'archived' },
  { pattern: '/olvide', page: 'forgot' },
  { pattern: '/accion', page: 'action' },
  { pattern: '/registro/:token', page: 'register' },
  { pattern: '/registro', page: 'registerInfo' },
  { pattern: '/solicitar', page: 'request' },
  { pattern: '/facilitacion/invitaciones', page: 'facilitationInvitations' },
  { pattern: '/facilitacion/solicitudes', page: 'facilitationEnrollments' },
  { pattern: '/facilitacion/cuentas', page: 'facilitationAccounts' },
  { pattern: '/apices/:id/historial', page: 'apiceHistory' },
  { pattern: '/apices/nuevo', page: 'apiceNew' },
  { pattern: '/apices/:id/editar', page: 'apiceEdit' },
  { pattern: '/apices/:id', page: 'apiceView' },
  // Rutas de la 003 (D-T10 (003)): prototipado, tablero, documentación y constitución.
  { pattern: '/prototipado', page: 'prototyping' },
  { pattern: '/tablero', page: 'dashboard' },
  { pattern: '/documentacion', page: 'documentation' },
  { pattern: '/documentacion/:articulo', page: 'documentation' },
  { pattern: '/constitucion', page: 'constitution' },
  // Rutas de la 004 (D-T13 (004)); las fijas van antes de `:id`.
  { pattern: '/constitucion/historial', page: 'constitutionHistory' },
  { pattern: '/constitucion/secciones/:id', page: 'constitutionSection' },
  { pattern: '/constitucion/documentos/:id', page: 'constitutionDocument' },
  { pattern: '/constitucion/propuestas', page: 'amendments' },
  { pattern: '/constitucion/propuestas/:id', page: 'amendmentDetail' },
  // Rutas de la 009: el foro y un hilo.
  { pattern: '/foro', page: 'forum' },
  { pattern: '/foro/:id', page: 'forumThread' },
];

export interface MatchedRoute {
  page: PageId;
  /** Parámetros del patrón (`/apices/:id` → `{ id }`); vacío si no hay. */
  params: Record<string, string>;
  /** Ruta normalizada, sin barra final salvo la raíz. */
  path: string;
}

export interface CurrentRoute extends MatchedRoute {
  /** Fragmento sin `#`, o `undefined` si no hay. */
  hash: string | undefined;
}

/** Quita la barra final (salvo en `/`) para que `/a/` y `/a` sean la misma ruta. */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function segments(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const expected = segments(pattern);
  const actual = segments(path);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i += 1) {
    const want = expected[i] ?? '';
    const got = actual[i] ?? '';
    if (want.startsWith(':')) {
      params[want.slice(1)] = decodeURIComponent(got);
    } else if (want !== got) {
      return null;
    }
  }
  return params;
}

/** Devuelve la página y los parámetros de `path`; `notFound` si ninguna ruta encaja. */
export function matchRoute(path: string): MatchedRoute {
  const requested = normalizePath(path);
  for (const route of ROUTES) {
    const params = matchPattern(route.pattern, requested);
    if (params) return { page: route.page, params, path: requested };
  }
  return { page: 'notFound', params: {}, path: requested };
}

/** Lee `window.location` y la convierte en la ruta actual. */
export function readLocation(location: Location = window.location): CurrentRoute {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  return { ...matchRoute(location.pathname), hash: hash === '' ? undefined : decodeURIComponent(hash) };
}

// Suscripción a los cambios de ruta: `navigate` y `popstate` avisan a los oyentes.
const listeners = new Set<() => void>();
let current: CurrentRoute | null = null;

function notify(): void {
  current = readLocation();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('popstate', notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', notify);
  };
}

function getSnapshot(): CurrentRoute {
  const fresh = readLocation();
  if (
    current &&
    current.path === fresh.path &&
    current.hash === fresh.hash &&
    current.page === fresh.page &&
    JSON.stringify(current.params) === JSON.stringify(fresh.params)
  ) {
    return current;
  }
  current = fresh;
  return current;
}

export interface NavigateOptions {
  replace?: boolean;
}

/** Cambia de ruta con `pushState` (o `replaceState`) y avisa a `useRoute`; `to` puede llevar `?query` y `#hash`. */
export function navigate(to: string, { replace = false }: NavigateOptions = {}): void {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  notify();
}

/** Desplaza la vista al elemento cuyo `id` es el `#hash` de la ruta, si existe, y le lleva el foco. */
export function scrollToHash(hash: string | undefined): boolean {
  if (!hash) return false;
  const target = document.getElementById(hash);
  if (!target) return false;
  target.scrollIntoView();
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return true;
}

/**
 * Ruta actual; se actualiza con `navigate` y con `popstate`. Tras cada cambio desplaza al
 * `#hash` o, si no lo hay, vuelve arriba y lleva el foco al contenido, para que quien navega
 * con teclado no se quede en `<body>`. Al cargar la página no se toca el foco.
 */
export function useRoute(): CurrentRoute {
  const route = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const mounted = useRef(false);
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (scrollToHash(route.hash) || first) return;
    window.scrollTo(0, 0);
    document.querySelector('main')?.focus();
  }, [route]);
  return route;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Enlace interno: intercepta el clic simple y llama a `navigate`; deja al navegador los demás. */
export function Link({ href, onClick, target, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isPlainLeftClick(event)) return;
    if (target && target !== '_self') return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handleClick} {...(target === undefined ? {} : { target })} {...rest} />;
}
