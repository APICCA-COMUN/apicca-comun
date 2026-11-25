// Enrutador mínimo del sitio: una tabla de rutas, `matchRoute` para resolverlas sin DOM,
// `navigate`/`useRoute` sobre la History API y un `Link` interno. Aún no hay control de
// acceso: toda ruta es pública hasta que una spec defina quién puede abrir qué.
// RF-11 (021), RF-14 (021) · 14.5, 14.8, D-T21 (021): `isMapPage` dice qué rutas pinta el mapa, y `keepFocus` deja el foco
// a los paneles.
// RF-14 (021) · 14.9: un segmento o un hash mal codificado (`%` suelto) ya no lanza
// `URIError`; y un «guardián de navegación» permite a una página con cambios sin guardar frenar `navigate` hacia fuera; `onNavigated` difiere una acción hasta que
// la navegación ocurre.
import { useEffect, useRef, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** Identificador de cada página, más la página no encontrada. */
export type PageId = 'home' | 'notFound' | 'login' | 'forgot' | 'action' | 'register' | 'registerInfo' | 'request' | 'facilitationInvitations' | 'facilitationEnrollments' | 'facilitationAccounts' | 'apiceHistory' | 'apiceNew' | 'apiceEdit' | 'archived' | 'apiceView' | 'prototyping' | 'dashboard' | 'documentation' | 'constitution' | 'constitutionHistory' | 'constitutionSection' | 'constitutionDocument' | 'amendments' | 'amendmentDetail' | 'forum' | 'forumThread' | 'actions' | 'actionNew' | 'actionView' | 'sketch';

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
  // RF-20 (021) · 20.5, D-T29 (021): los caminos; la fija va antes de `:id`.
  { pattern: '/acciones', page: 'actions' },
  { pattern: '/acciones/nueva', page: 'actionNew' },
  { pattern: '/acciones/:id', page: 'actionView' },
  // RF-23 (021) · 23.1, D-T39 (021): el boceto del visitante.
  { pattern: '/boceto', page: 'sketch' },
];

/** Páginas que pinta el mapa a pantalla completa, sin cabecera ni pie de sitio (RF-11 (021), RF-14 (021) · 14.5, D-T21 (021), D-T29 (021), D-T39 (021)). */
const MAP_PAGES: ReadonlySet<PageId> = new Set<PageId>(['home', 'apiceView', 'apiceNew', 'apiceEdit', 'actions', 'actionNew', 'actionView', 'sketch']);

export function isMapPage(page: PageId): boolean {
  return MAP_PAGES.has(page);
}

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

/** `decodeURIComponent` que no lanza: devuelve `null` si el texto tiene un `%` mal codificado. */
function safeDecode(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
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
      // Un segmento mal codificado no es de ninguna ruta: la dirección cae en «no encontrada».
      const decoded = safeDecode(got);
      if (decoded === null) return null;
      params[want.slice(1)] = decoded;
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
  // Un hash mal codificado se usa tal como viene: solo sirve para buscar un `id`, y no vale la pena perder la página por él.
  return { ...matchRoute(location.pathname), hash: hash === '' ? undefined : (safeDecode(hash) ?? hash) };
}

// Suscripción a los cambios de ruta: `navigate` y `popstate` avisan a los oyentes.
const listeners = new Set<() => void>();
let current: CurrentRoute | null = null;
/** La ruta a la que se llegó con `keepFocus`: su cambio no mueve el foco (D-T21 (021)). */
let quiet: CurrentRoute | null = null;

function notify(keepFocus = false): void {
  current = readLocation();
  quiet = keepFocus ? current : null;
  for (const listener of listeners) listener();
}

const onPopState = () => notify();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('popstate', onPopState);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', onPopState);
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
  /** El cambio de ruta no lleva el foco al contenido: quien navega lo mueve (los paneles del mapa, D-T21 (021)). */
  keepFocus?: boolean;
  /** Salta el guardián de navegación: quien ya preguntó a la persona (y ella confirmó) navega sin volver a preguntar. */
  unguarded?: boolean;
  /**
   * Una acción diferida: corre solo si la navegación de verdad ocurre. Si el guardián frena, no corre, y como el guardián reenvía
   * estas mismas opciones al confirmar, corre entonces. Va tras cambiar la dirección y antes de avisar a `useRoute`: la acción
   * ve ya la ruta nueva en `window.location` y nada se ha pintado todavía con ella (cerrar sesión tras ir al mapa, D-T13 (003);
   * olvidar la marca de bienvenida antes de que el mapa la lea).
   */
  onNavigated?: () => void;
}

/**
 * Guardián de navegación: se consulta antes de cada `navigate`. Devuelve `true` si se puede navegar; si devuelve `false`,
 * `navigate` no hace nada y el guardián se encarga de preguntar y, si la persona confirma, de navegar con `unguarded`.
 * Lo lee en vivo (no una copia del render), así que no hay carreras con el render que lo suelta.
 */
export type NavigationGuard = (to: string, options: NavigateOptions) => boolean;

let guard: NavigationGuard | null = null;

/** Registra el guardián (solo hay uno) y devuelve cómo soltarlo; soltar uno ya reemplazado no toca al nuevo. */
export function setNavigationGuard(next: NavigationGuard): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}

/** El camino (sin barra final) al que llevaría `to`, resuelto contra la dirección actual. */
export function pathOf(to: string): string {
  try {
    return normalizePath(new URL(to, window.location.href).pathname);
  } catch {
    return normalizePath(to.split(/[?#]/)[0] ?? '');
  }
}

/** Cambia de ruta con `pushState` (o `replaceState`) y avisa a `useRoute`; `to` puede llevar `?query` y `#hash`. */
export function navigate(to: string, options: NavigateOptions = {}): void {
  const { replace = false, keepFocus = false, unguarded = false, onNavigated } = options;
  if (!unguarded && guard !== null && !guard(to, options)) return;
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  onNavigated?.();
  notify(keepFocus);
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
    if (scrollToHash(route.hash) || first || route === quiet) return;
    window.scrollTo(0, 0);
    document.querySelector('main')?.focus();
  }, [route]);
  return route;
}

const readSearch = () => window.location.search;

/**
 * La consulta de la dirección (`?…`); cambia con `navigate` y con `popstate`, aunque la ruta siga igual. El mapa la usa
 * para sus filtros, «Lo mío» y la vista (RF-15 (021), D-T25 (021)).
 */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, readSearch, readSearch);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  /** Corre solo si el clic navega de verdad (no si un guardián lo frena, hasta que la persona confirma); ver `NavigateOptions`. */
  onNavigated?: () => void;
};

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Enlace interno: intercepta el clic simple y llama a `navigate`; deja al navegador los demás. */
export function Link({ href, onClick, onNavigated, target, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isPlainLeftClick(event)) return;
    if (target && target !== '_self') return;
    event.preventDefault();
    navigate(href, onNavigated === undefined ? {} : { onNavigated });
  };
  return <a href={href} onClick={handleClick} {...(target === undefined ? {} : { target })} {...rest} />;
}
