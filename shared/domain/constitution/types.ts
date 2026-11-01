// Formas de la constitución común y de sus propuestas (Principio 4, D-T6 (004); modelo de datos en plan §5).
// Solo tipos: los instantes son milisegundos desde la época; el almacén los guarda como `Timestamp`.

export type SectionVersionKind = 'initial' | 'change' | 'add' | 'remove';
export type AmendmentKind = 'change' | 'add' | 'remove';
export type AmendmentResult = 'approved' | 'rejected' | 'withdrawn';
export type AmendmentStatus = 'open' | AmendmentResult;
export type AgreementState = 'none' | 'active' | 'revoked' | 'withdrawn';
export type ObjectionStatus = 'open' | 'resolved' | 'withdrawn';
export type CloseReason = 'insufficient_agreements' | 'open_objection';
export type ConstitutionLogKind = 'opened' | 'changed' | 'added' | 'removed';

/** Estado del conjunto: `constitution/state` (D-T3 (004)). `order` incluye las secciones retiradas. */
export interface ConstitutionState {
  isOpen: boolean;
  openedAt: number | null;
  order: string[];
  updatedAt: number;
  logSeq: number;
}

/** Parte pública de una sección (`constitutionSections/{id}`). */
export interface Section {
  id: string;
  title: string;
  text: string;
  updatedAt: number;
  isRetired: boolean;
  retiredAt: number | null;
}

/** Autoría de la primera versión de cada sección al abrir la constitución (RF-4 (004) · 4.3, D-T11 (004)). */
export const INITIAL_AUTHOR = 'texto inicial';

/** Parte privada de una sección (`private/meta`), solo para cuentas activas (RF-2 (004) · 2.4). */
export interface SectionMeta {
  version: number;
  proposedByUid: string | null;
  proposedByUsername: string;
  openAmendment: { id: string; kind: AmendmentKind; closesAt: number } | null;
}

/** Versión inmutable de una sección (`versions/{n}`). */
export interface SectionVersion {
  version: number;
  title: string;
  text: string;
  kind: SectionVersionKind;
  amendmentId: string | null;
  /** Nulo en la primera versión, la del texto inicial (RF-4 (004) · 4.3). */
  proposedByUid: string | null;
  proposedByUsername: string;
  agreementsCounted: number;
  authorAgreementCounted: boolean;
  objectionsResolved: number;
  objectionsWithdrawn: number;
  at: number;
}

/** Propuesta de cambio (`amendments/{id}`). `after` nulo en «añadir» significa «al principio». */
export interface Amendment {
  id: string;
  kind: AmendmentKind;
  sectionId: string | null;
  after: string | null;
  slotKey: string;
  title: string;
  text: string;
  motive: string;
  revisionNo: number; // número de revisión; sin tilde, texts.test.ts (RNF-1 (001)) veta el nombre del plan
  baseSectionVersion: number | null;
  authorUid: string;
  authorUsername: string;
  /** El servidor lo mantiene al suspender y reactivar la cuenta de quien propuso (RF-14 (004) · 14.7). */
  authorSuspended: boolean;
  openedAt: number;
  closesAt: number;
  extended: boolean;
  isOpen: boolean;
  result: AmendmentResult | null;
  reasons: CloseReason[];
  closedAt: number | null;
  agreementsCounted: number;
  objectionsResolved: number;
  objectionsWithdrawn: number;
  newSectionId: string | null;
}

/** Postura de una persona (`stances/{uid}`). */
export interface Stance {
  uid: string;
  username: string;
  agreement: AgreementState;
  agreedAtRevision: number | null;
  agreedAt: number | null;
  openObjectionId: string | null;
  withdrawnReason: 'inactive' | null;
}

/** Objeción (`objections/{id}`). */
export interface Objection {
  id: string;
  uid: string;
  username: string;
  reason: string;
  status: ObjectionStatus;
  openedAt: number;
  closedAt: number | null;
  resolvedByRevision: number | null;
  closedBy: 'author' | 'inactive' | null;
}

/** Evento del registro de una propuesta (`events/{seq}`, D-T16 (004)). */
export interface AmendmentEvent {
  seq: number;
  kind: string;
  uid: string;
  username: string;
  at: number;
  detail?: Record<string, string | number | boolean | null>;
}
