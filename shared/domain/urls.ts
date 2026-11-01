// Direcciones de enlaces e imágenes y lista de enlaces.
// Una dirección válida empieza por "https://" sin distinguir mayúsculas, tiene
// algo detrás y no supera 2 000 puntos de código; se guarda tal como se escribió.
// El sitio solo pinta como enlace o imagen lo que `isSafeUrl` acepta.
import { LIMITS, countCodePoints, isBlank, validateLength } from './limits';

/** Enlace o imagen adjunto a un contenido. */
export interface Link {
  url: string;
  description: string;
  kind: 'link' | 'image';
}

const HTTPS_PREFIX = 'https://';

export type UrlResult = { ok: true } | { ok: false; reason: string };

/**
 * Comprueba una dirección y explica el motivo del rechazo.
 *
 * Los dos primeros motivos escriben «https://» con esas letras, y es lo único del sitio que
 * lo hace: quien los lee acaba de teclear una dirección a mano y el motivo le señala lo que
 * le falta a lo que escribió.
 */
export function validateUrl(url: string): UrlResult {
  if (!url.slice(0, HTTPS_PREFIX.length).toLowerCase().startsWith(HTTPS_PREFIX)) {
    return { ok: false, reason: 'la dirección debe empezar por https://' };
  }
  if (url.length === HTTPS_PREFIX.length) {
    return { ok: false, reason: 'la dirección debe tener algo detrás de https://' };
  }
  const length = validateLength(url, LIMITS.url);
  if (!length.ok) {
    return { ok: false, reason: `la dirección supera los ${LIMITS.url} caracteres (sobran ${length.excess})` };
  }
  return { ok: true };
}

/** Verdadero solo para direcciones que se pueden pintar como enlace o imagen. */
export function isSafeUrl(url: string): boolean {
  return validateUrl(url).ok;
}

export interface LinkError {
  /** Posición del enlace con problema; `null` si el problema es la lista entera. */
  index: number | null;
  reason: string;
}

export interface LinksResult {
  ok: boolean;
  errors: LinkError[];
}

const LINK_KINDS: ReadonlySet<string> = new Set<Link['kind']>(['link', 'image']);

/** Comprueba la lista de enlaces de una entrada o ficha: máximo 10, cada uno con dirección, descripción y tipo válidos. */
export function validateLinks(links: readonly Link[]): LinksResult {
  const errors: LinkError[] = [];
  if (links.length > LIMITS.links) {
    errors.push({ index: null, reason: `se admiten hasta ${LIMITS.links} enlaces (hay ${links.length})` });
  }
  links.forEach((link, index) => {
    const url = validateUrl(link.url);
    if (!url.ok) {
      errors.push({ index, reason: url.reason });
      return;
    }
    if (isBlank(link.description)) {
      errors.push({ index, reason: 'la descripción no puede estar vacía' });
      return;
    }
    if (countCodePoints(link.description) > LIMITS.linkDescription) {
      const excess = countCodePoints(link.description) - LIMITS.linkDescription;
      errors.push({ index, reason: `la descripción supera los ${LIMITS.linkDescription} caracteres (sobran ${excess})` });
      return;
    }
    if (!LINK_KINDS.has(link.kind)) {
      errors.push({ index, reason: 'el tipo debe ser enlace o imagen' });
    }
  });
  return { ok: errors.length === 0, errors };
}
