// Reglas de una propuesta: clave de lugar, contenido, posturas y acciones tardías
// (RF-6 (004), RF-10 (004), RF-11 (004), RF-12 (004)).
import { isDue } from './deadlines';
import type { AmendmentKind } from './types';

/** Clave de la cerradura de lugar: `s:ID` al cambiar y quitar; `a:ID` o `a:start` al añadir (RF-6 (004)). */
export function slotKeyOf(
  input: { kind: 'change' | 'remove'; sectionId: string } | { kind: 'add'; after: string | null },
): string {
  if (input.kind === 'add') return input.after === null ? 'a:start' : `a:${input.after}`;
  return `s:${input.sectionId}`;
}

export interface SectionContent {
  title: string;
  text: string;
}

export type ContentCheck = { ok: true } | { ok: false; reason: 'identical' };

/** Rechaza solo una propuesta de cambiar idéntica a la vigente (RF-6 (004)). */
export function checkProposedContent(
  kind: AmendmentKind,
  current: SectionContent | null,
  proposed: SectionContent,
): ContentCheck {
  if (kind === 'change' && current && current.title === proposed.title && current.text === proposed.text) {
    return { ok: false, reason: 'identical' };
  }
  return { ok: true };
}

export type AgreementCheck = { ok: true } | { ok: false; reason: 'author' | 'open_objection' };

/** Acordar: no lo hace quien propuso (su acuerdo es implícito) ni quien tiene una objeción abierta (RF-11 (004)). */
export function checkAgreement(input: { isAuthor: boolean; hasOpenObjection: boolean }): AgreementCheck {
  if (input.isAuthor) return { ok: false, reason: 'author' };
  if (input.hasOpenObjection) return { ok: false, reason: 'open_objection' };
  return { ok: true };
}

export type ObjectionCheck = { ok: true } | { ok: false; reason: 'author' | 'active_agreement' | 'already_objecting' };

/** Objetar: no lo hace quien propuso, quien tiene un acuerdo vigente ni quien ya tiene una objeción abierta (RF-10 (004)). */
export function checkObjection(input: {
  isAuthor: boolean;
  hasActiveAgreement: boolean;
  hasOpenObjection: boolean;
}): ObjectionCheck {
  if (input.isAuthor) return { ok: false, reason: 'author' };
  if (input.hasActiveAgreement) return { ok: false, reason: 'active_agreement' };
  if (input.hasOpenObjection) return { ok: false, reason: 'already_objecting' };
  return { ok: true };
}

/** Una acción después del vencimiento es tardía y se rechaza aunque la pantalla no se haya actualizado (RF-12 (004)). */
export function isLateAction(closesAt: number, now: number): boolean {
  return isDue(closesAt, now);
}
