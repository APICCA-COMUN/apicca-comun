// Tabla de transiciones de propuestas, objeciones y acuerdos (RF-8 (004), RF-10 (004), RF-12 (004)).
// La ampliación es una bandera de la propuesta, no un estado. Ningún estado cerrado tiene salida y no existe
// una transición de «adelantar el cierre»: aprobar o rechazar exige haber vencido.
import { isDue } from './deadlines';
import type { AgreementState, AmendmentStatus, ObjectionStatus } from './types';

export const AMENDMENT_TRANSITIONS: Record<AmendmentStatus, readonly AmendmentStatus[]> = {
  open: ['approved', 'rejected', 'withdrawn'],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export const OBJECTION_TRANSITIONS: Record<ObjectionStatus, readonly ObjectionStatus[]> = {
  open: ['resolved', 'withdrawn'],
  resolved: [],
  withdrawn: [],
};

export const AGREEMENT_TRANSITIONS: Record<AgreementState, readonly AgreementState[]> = {
  none: ['active'],
  active: ['revoked', 'withdrawn'],
  revoked: ['active'],
  withdrawn: ['active'],
};

/** Aprobar o rechazar solo vence el plazo (RF-12 (004)); retirar es de quien propuso y no espera (RF-8 (004)). */
export function canTransitionAmendment(
  from: AmendmentStatus,
  to: AmendmentStatus,
  at: { closesAt: number; now: number },
): boolean {
  if (!AMENDMENT_TRANSITIONS[from].includes(to)) return false;
  if (to === 'approved' || to === 'rejected') return isDue(at.closesAt, at.now);
  return true;
}

export function canTransitionObjection(from: ObjectionStatus, to: ObjectionStatus): boolean {
  return OBJECTION_TRANSITIONS[from].includes(to);
}

export function canTransitionAgreement(from: AgreementState, to: AgreementState): boolean {
  return AGREEMENT_TRANSITIONS[from].includes(to);
}
