// RF-12 (004) · 6, RNF-1 (004), D-T1 (004), D-T16 (004) · Base transaccional de las propuestas de cambio.
// Lo usan las ops de deliberación (abrir, revisar, retirar, comentar, acordar, objetar…) y, en el cierre, `settleAmendment`.
//
// Convenciones:
// - Todo se llama con la transacción de la op. Firestore exige leer antes de escribir: `readOpenAmendment` y `takeSlot`
//   leen; `releaseSlot`, `appendEvent` y `recordEvent` solo escriben. Una op lee primero y escribe después.
// - El registro (`events/{seq}`) lleva su correlativo en un contador `eventSeq` de la propia propuesta (D-T16 (004)).
//   `recordEvent` toma `eventSeq + 1` y lo deja avanzado en la misma transacción; dos ops simultáneas sobre la misma
//   propuesta se serializan porque ambas leyeron ese documento. `appendEvent` es la pieza baja con `seq` explícito,
//   para quien crea la propuesta (evento 1, con `eventSeq: 1` en el documento nuevo).
// - `settleAmendment` cierra una propuesta vencida (RF-12 (004), D-T5 (004), D-T8 (004)) y, si se aprueba, la aplica
//   (RF-13 (004)) en la misma transacción. Las fechas del cierre son el instante del vencimiento, no el del proceso.
// - Los instantes se guardan como `Timestamp`; los tipos del dominio los manejan como milisegundos.
import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import {
  evaluateClose,
  extendedDueAt,
  isDue,
  placeNewSection,
  type Amendment,
  type CloseOutcome,
} from '../../shared/domain/constitution';
import type { Ctx } from './context';
import { ApiError } from './errors';

/** Quién actúa: uid y nombre de usuario en ese momento (D-T16 (004)). */
export interface EventActor {
  uid: string;
  username: string;
}

/** Propuesta abierta leída dentro de la transacción. */
export interface OpenAmendment {
  amendment: Amendment;
  /** Último `seq` usado en `events`; el siguiente es `eventSeq + 1`. */
  eventSeq: number;
  ref: DocumentReference;
}

export interface AmendmentEventInput {
  /** Hecho: `opened`, `revised`, `withdrawn`, `commented`, `agreed`, `objected`, `extended`, `closed`… */
  kind: string;
  actor: EventActor;
  /** Datos propios del hecho; sin `undefined`. */
  detail?: Record<string, string | number | boolean | null>;
}

export type SlotResult = { ok: true } | { ok: false; taken: true; amendmentId: string };

export function amendmentRef(ctx: Ctx, amendmentId: string): DocumentReference {
  return ctx.db.doc(`amendments/${amendmentId}`);
}

function millis(value: unknown): number {
  return (value as Timestamp).toMillis();
}

function millisOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : millis(value);
}

/** Convierte el documento guardado (con `Timestamp`) a la forma del dominio. */
export function toAmendment(id: string, data: Record<string, unknown>): Amendment {
  return {
    id,
    kind: data['kind'] as Amendment['kind'],
    sectionId: (data['sectionId'] as string | null) ?? null,
    after: (data['after'] as string | null) ?? null,
    slotKey: data['slotKey'] as string,
    title: data['title'] as string,
    text: data['text'] as string,
    motive: data['motive'] as string,
    revisionNo: data['revisionNo'] as number,
    baseSectionVersion: (data['baseSectionVersion'] as number | null) ?? null,
    authorUid: data['authorUid'] as string,
    authorUsername: data['authorUsername'] as string,
    authorSuspended: data['authorSuspended'] === true,
    openedAt: millis(data['openedAt']),
    closesAt: millis(data['closesAt']),
    extended: data['extended'] === true,
    isOpen: data['isOpen'] === true,
    result: (data['result'] as Amendment['result']) ?? null,
    reasons: (data['reasons'] as Amendment['reasons'] | undefined) ?? [],
    closedAt: millisOrNull(data['closedAt']),
    agreementsCounted: (data['agreementsCounted'] as number | undefined) ?? 0,
    objectionsResolved: (data['objectionsResolved'] as number | undefined) ?? 0,
    objectionsWithdrawn: (data['objectionsWithdrawn'] as number | undefined) ?? 0,
    newSectionId: (data['newSectionId'] as string | null) ?? null,
  };
}

/**
 * Lee una propuesta que admite acciones (RF-12 (004) · 6). Lanza `amendment-not-found` si no existe y `amendment-closed`
 * si ya cerró o si su plazo venció, aunque nadie la haya procesado: la hora la manda `ctx.now()`, no el cierre programado.
 */
export async function readOpenAmendment(ctx: Ctx, tx: Transaction, amendmentId: string): Promise<OpenAmendment> {
  const ref = amendmentRef(ctx, amendmentId);
  const snap = await tx.get(ref);
  if (!snap.exists) throw new ApiError('amendment-not-found');
  const data = snap.data() as Record<string, unknown>;
  const amendment = toAmendment(amendmentId, data);
  if (!amendment.isOpen || isDue(amendment.closesAt, ctx.now().getTime())) throw new ApiError('amendment-closed');
  const eventSeq = typeof data['eventSeq'] === 'number' ? data['eventSeq'] : 0;
  return { amendment, eventSeq, ref };
}

/**
 * Toma la cerradura de lugar `amendmentSlots/{key}` (D-T1 (004)). Si otra propuesta ya la tiene, no escribe y responde
 * `{ ok: false, taken: true, amendmentId }` con la que la tiene, para enlazarla (RF-6 (004) · 5). Lee: va antes de escribir.
 */
export async function takeSlot(ctx: Ctx, tx: Transaction, slotKey: string, amendmentId: string): Promise<SlotResult> {
  const ref = ctx.db.doc(`amendmentSlots/${slotKey}`);
  const snap = await tx.get(ref);
  if (snap.exists) return { ok: false, taken: true, amendmentId: snap.get('amendmentId') as string };
  tx.set(ref, { amendmentId });
  return { ok: true };
}

/** Libera la cerradura al cerrar o retirar la propuesta que la tiene (RF-6 (004) · 6). Solo escribe. */
export function releaseSlot(ctx: Ctx, tx: Transaction, slotKey: string): void {
  tx.delete(ctx.db.doc(`amendmentSlots/${slotKey}`));
}

/** Escribe `amendments/{id}/events/{seq}` con quién (uid y nombre de ese momento) y cuándo (D-T16 (004), RNF-1 (004)). */
export function appendEvent(ctx: Ctx, tx: Transaction, amendmentId: string, seq: number, event: AmendmentEventInput): void {
  tx.create(amendmentRef(ctx, amendmentId).collection('events').doc(String(seq)), {
    seq,
    kind: event.kind,
    uid: event.actor.uid,
    username: event.actor.username,
    at: Timestamp.fromDate(ctx.now()),
    ...(event.detail ? { detail: event.detail } : {}),
  });
}

/**
 * Registra un hecho con el siguiente `seq` y avanza `eventSeq` en la propuesta. Devuelve el `seq` usado. Varias llamadas
 * en la misma transacción sobre la misma lectura avanzan entre sí (el contador se lleva en `open`).
 */
export function recordEvent(ctx: Ctx, tx: Transaction, open: OpenAmendment, event: AmendmentEventInput): number {
  const seq = open.eventSeq + 1;
  appendEvent(ctx, tx, open.amendment.id, seq, event);
  tx.update(open.ref, { eventSeq: seq });
  open.eventSeq = seq;
  return seq;
}

/** Quien firma los hechos que nadie ejecuta: el cierre y la ampliación por vencimiento (D-T16 (004)). */
export const SYSTEM_ACTOR: EventActor = { uid: 'system', username: 'sistema' };

/** Resultado de procesar una propuesta: `none` si no había nada que hacer (inexistente, cerrada o aún vigente). */
export type SettleResult = 'none' | 'extended' | 'approved' | 'rejected';

const newSectionId = (ctx: Ctx): string => Buffer.from(ctx.random(15)).toString('base64url');

async function countOf(tx: Transaction, query: { count(): { get(): Promise<unknown> } }): Promise<number> {
  const aggregate = query.count() as unknown as Parameters<Transaction['get']>[0];
  const snap = (await tx.get(aggregate)) as unknown as { data(): { count: number } };
  return snap.data().count;
}

/**
 * Cierra una propuesta cuyo plazo venció (RF-12 (004) · 1 a 3, 5; D-T5 (004), D-T8 (004)). Idempotente: si no existe, no está abierta
 * o aún no vence, no hace nada. Cuenta dentro de la transacción las cuentas activas, los acuerdos y las objeciones abiertas
 * (una suspensión o un acuerdo concurrentes la hacen reintentar). Si no se aprueba y no se había ampliado, amplía 360 h sobre
 * el cierre original; si procesa tarde y la ampliación también venció, decide en la misma llamada con las cuentas de ahora.
 */
export async function settleAmendment(ctx: Ctx, amendmentId: string): Promise<SettleResult> {
  return ctx.db.runTransaction(async (tx): Promise<SettleResult> => {
    const ref = amendmentRef(ctx, amendmentId);
    const snap = await tx.get(ref);
    if (!snap.exists) return 'none';
    const raw = snap.data() as Record<string, unknown>;
    const amendment = toAmendment(amendmentId, raw);
    const now = ctx.now().getTime();
    if (!amendment.isOpen || !isDue(amendment.closesAt, now)) return 'none';
    const open: OpenAmendment = { amendment, eventSeq: typeof raw['eventSeq'] === 'number' ? raw['eventSeq'] : 0, ref };

    const author = await tx.get(ctx.db.doc(`accounts/${amendment.authorUid}`));
    const counts = {
      activeAccounts: await countOf(tx, ctx.db.collection('accounts').where('status', '==', 'active')),
      otherAgreements: await countOf(tx, ref.collection('stances').where('agreement', '==', 'active')),
      openObjections: await countOf(tx, ref.collection('objections').where('status', '==', 'open')),
      authorActive: author.get('status') === 'active',
    };
    let outcome: CloseOutcome = evaluateClose({ ...counts, alreadyExtended: amendment.extended });
    let closesAt = amendment.closesAt;
    let extended = amendment.extended;
    if (outcome.result === 'extended') {
      closesAt = extendedDueAt(amendment.closesAt);
      extended = true;
      if (isDue(closesAt, now)) outcome = evaluateClose({ ...counts, alreadyExtended: true });
    }

    if (outcome.result === 'extended') {
      tx.update(ref, { closesAt: Timestamp.fromMillis(closesAt), extended: true });
      if (amendment.sectionId !== null) {
        tx.set(ctx.db.doc(`constitutionSections/${amendment.sectionId}/private/meta`), { openAmendment: { id: amendmentId, kind: amendment.kind, closesAt: Timestamp.fromMillis(closesAt) } }, { merge: true });
      }
      recordEvent(ctx, tx, open, { kind: 'extended', actor: SYSTEM_ACTOR, detail: { closesAt } });
      return 'extended';
    }

    const objectionsResolved = await countOf(tx, ref.collection('objections').where('status', '==', 'resolved'));
    const objectionsWithdrawn = await countOf(tx, ref.collection('objections').where('status', '==', 'withdrawn'));
    const apply = outcome.result === 'approved' ? await readApplication(ctx, tx, amendment) : null;

    const at = Timestamp.fromMillis(closesAt);
    tx.update(ref, {
      isOpen: false,
      result: outcome.result,
      reasons: outcome.reasons,
      closedAt: at,
      closesAt: at,
      extended,
      agreementsCounted: outcome.agreementsCounted,
      objectionsResolved,
      objectionsWithdrawn,
      ...(apply ? { newSectionId: apply.newSectionId } : {}),
    });
    releaseSlot(ctx, tx, amendment.slotKey);
    if (amendment.sectionId !== null) {
      tx.set(ctx.db.doc(`constitutionSections/${amendment.sectionId}/private/meta`), { openAmendment: null }, { merge: true });
    }
    if (extended && !amendment.extended) recordEvent(ctx, tx, open, { kind: 'extended', actor: SYSTEM_ACTOR, detail: { closesAt: extendedDueAt(amendment.closesAt) } });
    recordEvent(ctx, tx, open, {
      kind: 'closed',
      actor: SYSTEM_ACTOR,
      detail: { result: outcome.result, reasons: outcome.reasons.join(','), agreementsCounted: outcome.agreementsCounted, dueAt: closesAt },
    });
    if (apply) {
      writeApplication(ctx, tx, amendment, apply, {
        at,
        agreementsCounted: outcome.agreementsCounted,
        authorAgreementCounted: outcome.authorAgreementCounted,
        objectionsResolved,
        objectionsWithdrawn,
      });
    }
    return outcome.result;
  });
}

interface Application {
  state: Record<string, unknown>;
  section: Record<string, unknown> | null;
  version: number;
  newSectionId: string | null;
  position: number;
  order: string[];
}

/** Lee lo que la aplicación necesita (RF-13 (004)); va antes de toda escritura de la transacción. */
async function readApplication(ctx: Ctx, tx: Transaction, amendment: Amendment): Promise<Application> {
  const state = ((await tx.get(ctx.db.doc('constitution/state'))).data() ?? {}) as Record<string, unknown>;
  const order = Array.isArray(state['order']) ? (state['order'] as string[]) : [];
  if (amendment.kind === 'add') {
    const sections = order.length === 0 ? [] : await tx.getAll(...order.map((id) => ctx.db.doc(`constitutionSections/${id}`)));
    const vigentes = new Set(sections.filter((s) => s.exists && s.get('isRetired') !== true).map((s) => s.id));
    return { state, section: null, version: 1, newSectionId: newSectionId(ctx), position: placeNewSection(order, vigentes, amendment.after), order };
  }
  const sectionId = amendment.sectionId as string;
  const section = await tx.get(ctx.db.doc(`constitutionSections/${sectionId}`));
  const meta = await tx.get(ctx.db.doc(`constitutionSections/${sectionId}/private/meta`));
  const current = typeof meta.get('version') === 'number' ? (meta.get('version') as number) : 1;
  return { state, section: (section.data() ?? {}) as Record<string, unknown>, version: current + 1, newSectionId: null, position: -1, order };
}

/** Escribe la sección, su versión, el registro del conjunto y la fecha de la última modificación (RF-13 (004) · 1 a 5). */
function writeApplication(
  ctx: Ctx,
  tx: Transaction,
  amendment: Amendment,
  apply: Application,
  counted: { at: Timestamp; agreementsCounted: number; authorAgreementCounted: boolean; objectionsResolved: number; objectionsWithdrawn: number },
): void {
  const { at } = counted;
  const sectionId = amendment.kind === 'add' ? (apply.newSectionId as string) : (amendment.sectionId as string);
  const sectionRef = ctx.db.doc(`constitutionSections/${sectionId}`);
  const title = amendment.kind === 'remove' ? ((apply.section?.['title'] as string | undefined) ?? amendment.title) : amendment.title;
  const text = amendment.kind === 'remove' ? ((apply.section?.['text'] as string | undefined) ?? amendment.text) : amendment.text;
  const author = { proposedByUid: amendment.authorUid, proposedByUsername: amendment.authorUsername };
  tx.set(sectionRef.collection('versions').doc(String(apply.version)), {
    version: apply.version,
    title,
    text,
    kind: amendment.kind,
    amendmentId: amendment.id,
    ...author,
    agreementsCounted: counted.agreementsCounted,
    authorAgreementCounted: counted.authorAgreementCounted,
    objectionsResolved: counted.objectionsResolved,
    objectionsWithdrawn: counted.objectionsWithdrawn,
    at,
  });
  tx.set(sectionRef.collection('private').doc('meta'), { version: apply.version, ...author, openAmendment: null }, { merge: true });
  if (amendment.kind === 'add') {
    tx.set(sectionRef, { title, text, updatedAt: at, isRetired: false, retiredAt: null });
  } else if (amendment.kind === 'change') {
    tx.update(sectionRef, { title, text, updatedAt: at });
  } else {
    tx.update(sectionRef, { isRetired: true, retiredAt: at, updatedAt: at });
  }
  const order = [...apply.order];
  if (amendment.kind === 'add') order.splice(apply.position, 0, sectionId);
  const logSeq = (typeof apply.state['logSeq'] === 'number' ? apply.state['logSeq'] : 0) + 1;
  tx.set(ctx.db.doc(`constitutionLog/${logSeq}`), {
    seq: logSeq,
    kind: amendment.kind === 'add' ? 'added' : amendment.kind === 'remove' ? 'removed' : 'changed',
    sectionId,
    sectionTitle: title,
    version: apply.version,
    amendmentId: amendment.id,
    byUid: amendment.authorUid,
    byUsername: amendment.authorUsername,
    agreementsCounted: counted.agreementsCounted,
    authorAgreementCounted: counted.authorAgreementCounted,
    objectionsResolved: counted.objectionsResolved,
    objectionsWithdrawn: counted.objectionsWithdrawn,
    at,
  });
  tx.set(ctx.db.doc('constitution/state'), { ...apply.state, order, updatedAt: at, logSeq });
}

/** Ids de las propuestas vencidas a `now`, las de cierre más antiguo primero (consulta de D-T14 (004)). */
export async function dueAmendmentIds(ctx: Ctx, limit: number | null): Promise<string[]> {
  let query = ctx.db
    .collection('amendments')
    .where('isOpen', '==', true)
    .where('closesAt', '<=', Timestamp.fromDate(ctx.now()))
    .orderBy('closesAt', 'asc');
  if (limit !== null) query = query.limit(limit);
  return (await query.get()).docs.map((doc) => doc.id);
}

/** Procesa las vencidas (o la indicada) con `settleAmendment`; devuelve cuántas cambiaron. Lo usan `settleAmendments` y `amendmentCloser`. */
export async function settleDue(ctx: Ctx, options: { id?: string; limit?: number | null } = {}): Promise<number> {
  const ids = options.id !== undefined ? [options.id] : await dueAmendmentIds(ctx, options.limit ?? null);
  let changed = 0;
  for (const id of ids) {
    if ((await settleAmendment(ctx, id)) !== 'none') changed += 1;
  }
  return changed;
}

