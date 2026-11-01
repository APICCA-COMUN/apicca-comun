// Ápices: tipos, vocabulario base y validación de la ficha (RF-6 (001), RF-7 (001), RF-8 (001)).
// Los términos del dominio van en español; los identificadores técnicos, en inglés.
import { LIMITS, countCodePoints, isBlank } from './limits';
import type { ErrorCode } from './messages';

/** Los cinco ejes de autonomías compartidas. */
export const AXES = ['agua', 'alimento', 'cobijo', 'energía', 'comunicación'] as const;
export type Axis = (typeof AXES)[number];

export const APICE_STATUSES = ['idea', 'prototipo', 'en marcha'] as const;
export type ApiceStatus = (typeof APICE_STATUSES)[number];

/** Todo ápice nace como idea. */
export const INITIAL_APICE_STATUS: ApiceStatus = 'idea';

export const VISIBILITIES = ['private', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Lo que se escribe en la ficha; la ubicación se agrega en el Hito 4. */
export interface ApiceContent {
  name: string;
  description: string;
  axes: Axis[];
  needs: string;
  offers: string;
}

/** Lo que llega de un formulario o de una op: los opcionales pueden faltar y los ejes aún no son de confianza. */
export interface ContentInput {
  name: string;
  description: string;
  axes: readonly string[];
  needs?: string;
  offers?: string;
}

export type ContentField = 'name' | 'description' | 'axes' | 'needs' | 'offers';

/** Un problema de la ficha: qué campo y por qué; `excess` dice cuántos caracteres sobran. */
export interface ContentIssue {
  field: ContentField;
  code: ErrorCode;
  excess?: number;
}

export type ContentValidation = { ok: true; value: ApiceContent } | { ok: false; issues: ContentIssue[] };

/** Recorta los extremos de cada texto y conserva los saltos de línea interiores (RF-7 (001)). */
export function normalizeContent(input: ContentInput): ContentInput & { needs: string; offers: string } {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    axes: [...input.axes],
    needs: (input.needs ?? '').trim(),
    offers: (input.offers ?? '').trim(),
  };
}

// Control C0 y C1 salvo tabulación, salto de línea y retorno de carro.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
// El nombre es una sola línea: ahí también sobran el salto, el retorno y la tabulación.
const CONTROL_SINGLE_LINE = /[\u0000-\u001F\u007F-\u009F]/;

const isAxis = (value: string): value is Axis => (AXES as readonly string[]).includes(value);

function textIssue(field: ContentField, text: string, limit: number, singleLine: boolean): ContentIssue | null {
  if ((singleLine ? CONTROL_SINGLE_LINE : CONTROL).test(text)) return { field, code: 'control-characters' };
  const excess = countCodePoints(text) - limit;
  return excess > 0 ? { field, code: 'text-too-long', excess } : null;
}

/** Normaliza y valida la ficha; devuelve el contenido normalizado o todos los problemas, por campo. */
export function validateContent(input: ContentInput): ContentValidation {
  const content = normalizeContent(input);
  const issues: ContentIssue[] = [];
  const push = (issue: ContentIssue | null): void => {
    if (issue !== null) issues.push(issue);
  };

  if (isBlank(content.name)) issues.push({ field: 'name', code: 'field-required' });
  else push(textIssue('name', content.name, LIMITS.title, true));
  if (isBlank(content.description)) issues.push({ field: 'description', code: 'field-required' });
  else push(textIssue('description', content.description, LIMITS.text, false));

  if (content.axes.length === 0) issues.push({ field: 'axes', code: 'field-required' });
  else if (!content.axes.every(isAxis)) issues.push({ field: 'axes', code: 'axis-unknown' });
  else if (new Set(content.axes).size !== content.axes.length) issues.push({ field: 'axes', code: 'axes-duplicated' });

  push(textIssue('needs', content.needs, LIMITS.text, false));
  push(textIssue('offers', content.offers, LIMITS.text, false));

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { ...content, axes: content.axes.filter(isAxis) } };
}
