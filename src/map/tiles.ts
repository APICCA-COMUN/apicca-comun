// RF-21 (001) · Proveedor de teselas del mapa: un único lugar para cambiarlo (D-13 (001), D-T11 (001)).
// La URL pública de OpenStreetMap solo es aceptable para el prototipo: debe sustituirse por un
// proveedor adecuado antes de abrir el sitio a más personas.
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** La URL de teselas: `VITE_TILE_URL` si existe (solo la define el proyecto `browser`), si no, OSM (D-T13 (002)). */
export function tileUrl(env: { VITE_TILE_URL?: string }): string {
  return env.VITE_TILE_URL || OSM_TILE_URL;
}

export const TILE_URL = tileUrl({ VITE_TILE_URL: import.meta.env.VITE_TILE_URL });

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">Colaboradores de OpenStreetMap</a>';

/** Vista inicial cuando no hay puntos que encuadrar: el continente, sin precisar. */
export const DEFAULT_CENTER: readonly [number, number] = [-15, -60];
export const DEFAULT_ZOOM = 3;
export const MAX_ZOOM = 18;
