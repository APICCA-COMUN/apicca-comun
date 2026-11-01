// El tema del sitio. Dos temas, claro y oscuro, y dos maneras de llegar a uno: la preferencia
// que la persona ya declaró en su sistema, que es lo que manda mientras nadie elija, y un
// conmutador, que a partir de ahí manda en ese navegador.
//
// La elección se guarda en `localStorage` y no en la cuenta: las vistas públicas se ven sin
// sesión, y guardarla por persona obligaría a escribir en el almacén común y dejaría fuera
// justo a quien todavía no ha entrado.

import { TOKENS } from '../../shared/domain/identity';

export type Theme = 'light' | 'dark';

/** La misma clave que usa el guion de arranque de `index.html`; una prueba las cruza. */
export const THEME_KEY = 'apicca-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

/** Lo que esta persona eligió en este navegador, o nada si nunca eligió. */
export function savedTheme(): Theme | null {
  // En una ventana privada, o con el almacenamiento del sitio bloqueado, esto lanza. Se pierde
  // la memoria del tema, no la página.
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return isTheme(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** El tema que el sistema de quien visita declara. */
export function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * El tema que se está viendo. El atributo del documento va primero porque es la verdad de lo
 * que hay pintado: lo pone el guion de arranque y lo pone el conmutador, y en una ventana
 * privada —donde no se puede guardar nada— es lo único que queda. Después lo guardado, para el
 * instante anterior a que React monte, y al final la preferencia del sistema.
 */
export function currentTheme(): Theme {
  const set = document.documentElement.dataset['theme'];
  if (isTheme(set)) return set;
  return savedTheme() ?? systemTheme();
}

/**
 * Deja el tema puesto: el atributo que la hoja mira, las dos `theme-color` con su fondo
 * (RF-11 (002) · 11.3, D-T7 (002)) y la memoria para la próxima visita.
 * El atributo solo existe cuando alguien eligió; sin él, manda `prefers-color-scheme`.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = TOKENS[theme].background;
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin memoria, pero con el tema puesto en esta página.
  }
}

/**
 * Quita la elección de esta página: sin atributo manda `prefers-color-scheme` y cada `theme-color`
 * vuelve al fondo de su esquema, como lo deja el arranque de `index.html` (RF-11 (002) · 11.3, D-T7 (002)).
 */
export function clearTheme(): void {
  delete document.documentElement.dataset['theme'];
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = TOKENS[meta.media.includes('dark') ? 'dark' : 'light'].background;
  }
}

/**
 * Avisa cuando el sistema cambia de tema, para que el sitio le siga mientras nadie haya
 * elegido. Devuelve la manera de dejar de escuchar.
 */
export function observeSystem(onChange: (theme: Theme) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent): void => {
    onChange(event.matches ? 'dark' : 'light');
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
