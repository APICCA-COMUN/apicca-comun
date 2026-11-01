// Validadores de límites y formato de textos de la constitución (RF-16 (004), D-T17 (004)).
// Título, texto, motivo y comentario se miden en puntos de código Unicode sobre `LIMITS`,
// rechazan contenido vacío o de solo espacios, informan el exceso de caracteres con `excessReason`
// y admiten el formato y los enlaces de `textFormat.ts`. Dominio puro sin React ni Firebase.
import { LIMITS, excessReason, isBlank, validateLength } from '../limits';
import { textLinkErrors } from '../textFormat';

/** Topes de caracteres y cuotas de la constitución común (RF-16 (004) · 1, D-T17 (004), D-12 (004)). */
export const CONSTITUTION_LIMITS = {
  /** Título de una sección de la constitución (RF-16 (004) · 1). */
  sectionTitle: LIMITS.title,
  /** Título de un documento de la constitución (RF-16 (004) · 1). */
  documentTitle: LIMITS.title,
  /** Texto completo de una sección (RF-16 (004) · 1). */
  sectionText: LIMITS.text,
  /** Texto completo de un documento (RF-16 (004) · 1). */
  documentText: LIMITS.text,
  /** Texto propuesto para una sección (RF-16 (004) · 1). */
  proposalText: LIMITS.text,
  /** Motivo de una propuesta o de una objeción (RF-16 (004) · 1). */
  reason: LIMITS.reason,
  /** Comentario de una deliberación (RF-16 (004) · 1). */
  comment: LIMITS.comment,
  /** Máximo de propuestas de cambio abiertas simultáneamente (RF-16 (004) · 4, D-12 (004)). */
  openAmendments: LIMITS.openAmendments,
} as const;

export type ConstitutionTextKind =
  | 'title'
  | 'sectionTitle'
  | 'documentTitle'
  | 'sectionText'
  | 'section'
  | 'documentText'
  | 'document'
  | 'proposalText'
  | 'proposal'
  | 'reason'
  | 'comment';

/** Resultado de validar un texto de la constitución. */
export interface ConstitutionTextValidation {
  ok: boolean;
  value: string;
  /** Motivo en español del rechazo si `ok` es falso; no está presente si es válido. */
  reason?: string;
  /** Cuántos caracteres sobran si superó el tope; 0 si cabe o si está vacío. */
  excess: number;
  /** Lista de mensajes con los enlaces no válidos o mal formados. */
  linkErrors: string[];
}

const LABELS: Record<ConstitutionTextKind, string> = {
  title: 'El título',
  sectionTitle: 'El título',
  documentTitle: 'El título',
  sectionText: 'El texto',
  section: 'El texto',
  documentText: 'El texto',
  document: 'El texto',
  proposalText: 'El texto',
  proposal: 'El texto',
  reason: 'El motivo',
  comment: 'El comentario',
};

const LIMIT_FOR_KIND: Record<ConstitutionTextKind, number> = {
  title: CONSTITUTION_LIMITS.sectionTitle,
  sectionTitle: CONSTITUTION_LIMITS.sectionTitle,
  documentTitle: CONSTITUTION_LIMITS.documentTitle,
  sectionText: CONSTITUTION_LIMITS.sectionText,
  section: CONSTITUTION_LIMITS.sectionText,
  documentText: CONSTITUTION_LIMITS.documentText,
  document: CONSTITUTION_LIMITS.documentText,
  proposalText: CONSTITUTION_LIMITS.proposalText,
  proposal: CONSTITUTION_LIMITS.proposalText,
  reason: CONSTITUTION_LIMITS.reason,
  comment: CONSTITUTION_LIMITS.comment,
};

/**
 * Validador general de un texto de la constitución común según su tipo (RF-16 (004), D-T17 (004)).
 * Rechaza textos vacíos o con solo espacios, textos que superen el límite de caracteres
 * e informa el exceso exacto con `excessReason`, y comprueba los enlaces con `textFormat.ts`.
 */
export function validateConstitutionText(raw: string, kind: ConstitutionTextKind): ConstitutionTextValidation {
  if (isBlank(raw)) {
    return {
      ok: false,
      value: raw,
      reason: 'Falta un texto obligatorio: no puede quedar vacío ni con solo espacios.',
      excess: 0,
      linkErrors: [],
    };
  }

  const limit = LIMIT_FOR_KIND[kind];
  const label = LABELS[kind];
  const length = validateLength(raw, limit);
  const linkErrors = textLinkErrors(raw);

  if (!length.ok) {
    return {
      ok: false,
      value: raw,
      reason: excessReason(label, length),
      excess: length.excess,
      linkErrors,
    };
  }

  if (linkErrors.length > 0) {
    return {
      ok: false,
      value: raw,
      reason: linkErrors.join(' '),
      excess: 0,
      linkErrors,
    };
  }

  return {
    ok: true,
    value: raw,
    excess: 0,
    linkErrors: [],
  };
}

/** Valida el título de una sección de la constitución (RF-16 (004) · 1–3). */
export function validateSectionTitle(title: string): ConstitutionTextValidation {
  return validateConstitutionText(title, 'sectionTitle');
}

/** Valida el título de un documento de la constitución (RF-16 (004) · 1–3). */
export function validateDocumentTitle(title: string): ConstitutionTextValidation {
  return validateConstitutionText(title, 'documentTitle');
}

/** Valida un título de la constitución (RF-16 (004) · 1–3). */
export function validateTitle(title: string): ConstitutionTextValidation {
  return validateConstitutionText(title, 'title');
}

/** Valida el texto de una sección de la constitución (RF-16 (004) · 1–3). */
export function validateSectionText(text: string): ConstitutionTextValidation {
  return validateConstitutionText(text, 'sectionText');
}

/** Alias para validar el texto de una sección (RF-16 (004) · 1–3). */
export function validateSection(text: string): ConstitutionTextValidation {
  return validateConstitutionText(text, 'section');
}

/** Valida el motivo de una propuesta o de una objeción (RF-16 (004) · 1–3). */
export function validateReason(reason: string): ConstitutionTextValidation {
  return validateConstitutionText(reason, 'reason');
}

/** Valida el comentario de una deliberación (RF-16 (004) · 1–3). */
export function validateComment(comment: string): ConstitutionTextValidation {
  return validateConstitutionText(comment, 'comment');
}

/** Valida el texto de un documento de la constitución (RF-16 (004) · 1–3). */
export function validateDocumentText(text: string): ConstitutionTextValidation {
  return validateConstitutionText(text, 'documentText');
}

/** Alias para validar el texto de un documento (RF-16 (004) · 1–3). */
export function validateDocument(text: string): ConstitutionTextValidation {
  return validateConstitutionText(text, 'document');
}

/** Valida el texto propuesto para una sección (RF-16 (004) · 1–3). */
export function validateProposalText(text: string): ConstitutionTextValidation {
  return validateConstitutionText(text, 'proposalText');
}

/** Alias para validar el texto propuesto para una sección (RF-16 (004) · 1–3). */
export function validateProposal(text: string): ConstitutionTextValidation {
  return validateConstitutionText(text, 'proposal');
}
