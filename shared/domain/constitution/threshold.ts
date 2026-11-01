// Umbral de cierre de una propuesta (RF-12 (004), RF-11 (004), RF-14 (004), D-T8 (004)).
// Sin objeciones abiertas, al menos un acuerdo ajeno y 2 × acuerdos contados ≥ cuentas activas.
// El acuerdo implícito de quien propone suma 1 solo si su cuenta está activa (RF-14 (004)).
import type { CloseReason } from './types';

export interface CloseCounts {
  /** Cuentas activas en el instante del cierre. */
  activeAccounts: number;
  /** Acuerdos vigentes de personas distintas de quien propone. */
  otherAgreements: number;
  openObjections: number;
  /** La cuenta de quien propone está activa. */
  authorActive: boolean;
  alreadyExtended: boolean;
}

export interface CloseOutcome {
  result: 'approved' | 'extended' | 'rejected';
  reasons: CloseReason[];
  /** Acuerdos que contaron, con el implícito si lo hubo. */
  agreementsCounted: number;
  authorAgreementCounted: boolean;
}

export function evaluateClose(counts: CloseCounts): CloseOutcome {
  const authorAgreementCounted = counts.authorActive;
  const agreementsCounted = counts.otherAgreements + (authorAgreementCounted ? 1 : 0);
  const enough = counts.otherAgreements >= 1 && 2 * agreementsCounted >= counts.activeAccounts;
  const reasons: CloseReason[] = [];
  if (!enough) reasons.push('insufficient_agreements');
  if (counts.openObjections > 0) reasons.push('open_objection');
  const approved = reasons.length === 0;
  const result = approved ? 'approved' : counts.alreadyExtended ? 'rejected' : 'extended';
  return { result, reasons, agreementsCounted, authorAgreementCounted };
}
