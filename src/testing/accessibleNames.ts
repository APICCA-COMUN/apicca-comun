// Auxiliar de prueba (RF-17 (003) · 17.3, D-T21 (003)): el conjunto de `{ role, name }` de botones, enlaces y
// campos dentro de `<main>`, para comparar cada pantalla con la línea base de la 002 sin agregar ni quitar.
// El nombre se calcula con las reglas que usan estas páginas (aria-labelledby, aria-label, etiqueta, texto,
// title); no pretende cubrir todo el algoritmo de nombres accesibles. Se omiten los controles propios de Leaflet.

export type AccessibleName = { role: string; name: string };

const CONTROLS = 'a[href], button, input, select, textarea, [role="button"], [role="link"]';

const INPUT_ROLES: Record<string, string> = {
  checkbox: 'checkbox',
  radio: 'radio',
  search: 'searchbox',
  button: 'button',
  submit: 'button',
  reset: 'button',
  range: 'slider',
  number: 'spinbutton',
};

/** Un control dentro de su etiqueta no suma su contenido (las opciones de una lista, por ejemplo). */
const EMBEDDED = 'select, input, textarea';

/** Los controles propios de Leaflet (zoom, créditos) no son de la interfaz de APICCA; los marcadores sí. */
const IGNORED = '.leaflet-control-container';

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

function roleOf(element: HTMLElement): string {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit;
  if (element instanceof HTMLAnchorElement) return 'link';
  if (element instanceof HTMLButtonElement) return 'button';
  if (element instanceof HTMLSelectElement) return element.multiple || element.size > 1 ? 'listbox' : 'combobox';
  if (element instanceof HTMLTextAreaElement) return 'textbox';
  if (element instanceof HTMLInputElement) return INPUT_ROLES[element.type] ?? 'textbox';
  return element.tagName.toLowerCase();
}

/** El texto visible de un elemento, sin lo que está oculto a la tecnología de apoyo. */
function textOf(element: Element): string {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    else if (node instanceof Element && node.matches(EMBEDDED)) continue;
    else if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true' && !(node as HTMLElement).hidden) {
      text += ` ${node.getAttribute('aria-label') ?? textOf(node)} `;
    }
  }
  return squash(text);
}

function nameOf(element: HTMLElement): string {
  const labelledby = element.getAttribute('aria-labelledby');
  if (labelledby) {
    const parts = labelledby.split(/\s+/).map((id) => element.ownerDocument.getElementById(id));
    return squash(parts.map((part) => (part ? textOf(part) : '')).join(' '));
  }
  const label = element.getAttribute('aria-label');
  if (label) return squash(label);
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const labels = element.labels ? [...element.labels] : [];
    if (labels.length) return squash(labels.map(textOf).join(' '));
    if (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)) return squash(element.value);
    return squash(element.getAttribute('title') ?? element.getAttribute('placeholder') ?? '');
  }
  return textOf(element) || squash(element.getAttribute('title') ?? '');
}

const isHidden = (element: HTMLElement): boolean =>
  (element instanceof HTMLInputElement && element.type === 'hidden') ||
  element.closest(`[hidden], [aria-hidden="true"], ${IGNORED}`) !== null;

/** Los nombres accesibles de los controles dentro de `<main>`, sin repetir y en orden estable. */
export function accessibleNames(root: ParentNode): AccessibleName[] {
  const main = root.querySelector('main');
  if (!main) return [];
  const seen = new Map<string, AccessibleName>();
  for (const element of main.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (isHidden(element)) continue;
    const entry = { role: roleOf(element), name: nameOf(element) };
    seen.set(`${entry.role}\u0000${entry.name}`, entry);
  }
  return [...seen.values()].sort((a, b) => a.role.localeCompare(b.role, 'es') || a.name.localeCompare(b.name, 'es'));
}
