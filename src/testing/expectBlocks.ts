// Auxiliar de prueba (RF-6 (002) · 6.1, RF-2 (002) · 2.1, plan §0): todo control, diálogo y aviso
// es un bloque; radios y casillas llevan `choice`; ningún atributo `style` escribe un color (D-T20 (002)); `fill` y `stroke` valen solo con `var(--…)`.
// Fuera quedan `input[type=hidden]` y lo que está dentro del mapa, que estiliza `pin.css`.
// `blockNesting` (RF-3 (003) · 3.3, D-T4 (003), D-24 (003), D-28 (003)) marca un bloque dentro de otro.
import { expect } from 'vitest';

const NEEDS_BLOCK = 'button, input, select, textarea, [role="dialog"], [role="alert"], [role="status"]';

/** Propiedades de color que un `style` no puede tocar; los atajos se comprueban por sus partes. */
const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'accent-color',
  'caret-color',
  'fill',
  'stroke',
  'box-shadow',
];

/** Propiedades de pintura SVG: se aceptan con un token. */
const SVG_PAINT = ['fill', 'stroke'];

/** La etiqueta de apertura, para que el mensaje diga qué elemento falla. */
const openingTag = (element: Element): string => element.outerHTML.slice(0, element.outerHTML.indexOf('>') + 1);

const inMap = (element: Element): boolean => element.closest('.leaflet-container') !== null;

const CONTROLS = 'button, input, select, textarea';

/** Un contenedor de bloque: `.block` que no es un control ni un enlace con forma de botón. */
const isBlockContainer = (element: Element): boolean =>
  element.classList.contains('block') && !element.matches(`${CONTROLS}, a, .icon-button`);

/**
 * «E3 · Celda»: un botón o enlace con una pieza del sistema no es un bloque y no lleva caja: las piezas `c-*`
 * (`.c-barra`, `.c-enlace`, `.c-rot`, `.c-fila`, `.c-art`…) y los controles de las leyendas (`.leyenda-control__boton`).
 */
const isPieza = (element: Element): boolean =>
  [...element.classList].some((name) => name.startsWith('c-') || name.startsWith('leyenda-control'));

/** Un valor de `style` que no es un color escrito a mano: `var(--token)`, o `none` (sin relleno ni trazo). */
const isTokenValue = (value: string): boolean => /^var\(--[\w-]+\)$/.test(value.trim()) || value.trim() === 'none';

const isAlert = (element: Element): boolean => element.matches('[role="alert"], [role="status"]');

const insideBlock = (element: Element): boolean => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (isBlockContainer(parent)) return true;
  }
  return false;
};

/**
 * Los `.block` que viven dentro de otro bloque (RF-3 (003) · 3.3). Quedan fuera, como hijos, los botones,
 * los `a.block` y los `.icon-button` (D-24 (003)), y el edificio de un ápice, `.building` (D-28 (003));
 * campos y demás controles no cuentan como contenedor.
 */
export function blockNesting(container: ParentNode): string[] {
  const problems: string[] = [];
  for (const element of container.querySelectorAll<HTMLElement>('.block')) {
    if (inMap(element)) continue;
    // Botones y campos no son contenedores: pueden ir dentro de un bloque (D-T4 (003)).
    if (element.matches('button, a, .icon-button, input, select, textarea')) continue;
    // El edificio conserva su forma y su sombra dentro de una tarjeta o un lote (D-28 (003)).
    if (element.classList.contains('building')) continue;
    if (insideBlock(element)) problems.push(`bloque anidado: ${openingTag(element)}`);
  }
  return problems;
}

/** Lo que incumple las reglas dentro de `container`; vacío si todo está bien. */
export function blockProblems(container: ParentNode, options: { nesting?: boolean } = {}): string[] {
  const problems: string[] = [];
  for (const element of container.querySelectorAll<HTMLElement>(NEEDS_BLOCK)) {
    if (inMap(element)) continue;
    const type = element instanceof HTMLInputElement ? element.type : '';
    if (type === 'hidden') continue;
    if (type === 'radio' || type === 'checkbox') {
      if (!element.classList.contains('choice')) problems.push(`sin «choice»: ${openingTag(element)}`);
      continue;
    }
    // Con `nesting`, un aviso dentro de otro bloque va como texto en línea y no lleva `.block` (D-T4 (003)).
    if (options.nesting && isAlert(element) && insideBlock(element)) continue;
    if (element.matches('button, a') && isPieza(element)) continue;
    if (!element.classList.contains('block')) problems.push(`sin «block»: ${openingTag(element)}`);
  }
  for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
    if (inMap(element)) continue;
    // `fill` y `stroke` (dibujo SVG) pueden venir de un token (`var(--…)`); un literal sigue prohibido.
    const writesColor = COLOR_PROPERTIES.some((property) => {
      const value = element.style.getPropertyValue(property);
      if (value === '') return false;
      return !(SVG_PAINT.includes(property) && isTokenValue(value));
    });
    if (writesColor) {
      problems.push(`color en style: ${openingTag(element)}`);
    }
  }
  if (options.nesting) problems.push(...blockNesting(container));
  return problems;
}

/**
 * Falla la prueba con la lista de lo que incumple. `nesting` suma `blockNesting` y relaja el `.block`
 * de los avisos dentro de un bloque; sigue apagado por omisión hasta que T-2.3 lo active.
 */
export function expectBlocks(container: ParentNode, options: { nesting?: boolean } = {}): void {
  expect(blockProblems(container, options)).toEqual([]);
}
