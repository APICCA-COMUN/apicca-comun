// RF-16 (004) · 16.1, 16.2, 16.3, RF-5 (004) · 5.3 · Lectura común de títulos, textos, motivos y comentarios de la
// constitución que llegan en el payload de las ops: vacío o solo espacios es `text-empty` y el exceso informa
// cuántos caracteres sobran (`excessReason`, D-T17 (004)).
import { validateConstitutionText, type ConstitutionTextKind } from '../../../shared/domain/constitution';
import { ApiError } from '../errors';

/** Rechazo con el motivo de la validación como mensaje: exceso de caracteres o enlaces mal formados. */
export class ConstitutionTextError extends ApiError {
  constructor(code: 'text-too-long' | 'invalid-request', reason: string) {
    super(code);
    this.message = reason;
  }
}

function read(raw: unknown, kind: ConstitutionTextKind): string {
  if (typeof raw !== 'string') throw new ApiError('invalid-request');
  const checked = validateConstitutionText(raw, kind);
  if (checked.ok) return raw;
  if (raw.trim().length === 0) throw new ApiError('text-empty');
  if (checked.excess > 0) throw new ConstitutionTextError('text-too-long', checked.reason ?? '');
  throw new ConstitutionTextError('invalid-request', checked.reason ?? '');
}

/** Título de una sección o de un documento. */
export const readTitle = (raw: unknown, owner: 'section' | 'document'): string =>
  read(raw, owner === 'section' ? 'sectionTitle' : 'documentTitle');

/** Texto de una sección o de un documento. */
export const readText = (raw: unknown, owner: 'section' | 'document'): string =>
  read(raw, owner === 'section' ? 'sectionText' : 'documentText');

/** Motivo de una propuesta o de una objeción. */
export const readReason = (raw: unknown): string => read(raw, 'reason');

/** Comentario de una deliberación. */
export const readComment = (raw: unknown): string => read(raw, 'comment');
