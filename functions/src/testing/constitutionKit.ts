// Utillaje de las pruebas de ops de la constitución común; no es código de producción ni cita requisitos.
// Siembra con el Admin SDK (sin reglas) la forma de plan §5 (004): estado, secciones con `private/meta` y
// `versions`, y documentos con `versions`; propuestas con sus subcolecciones y cuentas suspendidas (T-6.15).
import { Timestamp } from 'firebase-admin/firestore';
import { dueAt, slotKeyOf, type AgreementState, type AmendmentKind, type AmendmentResult, type CloseReason, type ObjectionStatus } from '../../../shared/domain/constitution';
import type { Ctx } from '../context';
import { seedAccount, type SeedAccount } from './index';

export interface SeedSection {
  id: string;
  title?: string;
  text?: string;
  isRetired?: boolean;
  /** Versión vigente. Con historial (por omisión, solo si la constitución está abierta) se siembran `versions/1..version`. */
  version?: number;
  /** Autoría vigente en `private/meta`. */
  proposedByUid?: string;
  proposedByUsername?: string;
  /** Fuerza o impide `private/meta` y `versions`; por omisión, los lleva solo una constitución abierta. */
  withHistory?: boolean;
  updatedAt?: Date;
}

export interface SeedConstitution {
  isOpen?: boolean;
  openedAt?: Date | null;
  /** Por omisión, los ids de `sections` en su orden. */
  order?: string[];
  updatedAt?: Date;
  logSeq?: number;
  sections?: SeedSection[];
}

const OPEN_AT = new Date('2026-09-01T12:00:00Z');

/** Siembra `constitution/state` y las secciones indicadas. Devuelve el orden guardado. */
export async function seedConstitution(ctx: Ctx, input: SeedConstitution = {}): Promise<{ order: string[] }> {
  const isOpen = input.isOpen ?? false;
  const sections = input.sections ?? [];
  const order = input.order ?? sections.map((section) => section.id);
  const now = ctx.now();
  const batch = ctx.db.batch();
  batch.set(ctx.db.doc('constitution/state'), {
    isOpen,
    openedAt: isOpen ? Timestamp.fromDate(input.openedAt ?? OPEN_AT) : null,
    order,
    updatedAt: Timestamp.fromDate(input.updatedAt ?? now),
    logSeq: input.logSeq ?? (isOpen ? 1 : 0),
  });
  for (const section of sections) {
    const title = section.title ?? `Sección ${section.id}`;
    const text = section.text ?? `Texto de ${section.id}.`;
    const version = section.version ?? 1;
    const at = Timestamp.fromDate(section.updatedAt ?? now);
    const ref = ctx.db.doc(`constitutionSections/${section.id}`);
    const isRetired = section.isRetired ?? false;
    batch.set(ref, { title, text, updatedAt: at, isRetired, retiredAt: isRetired ? at : null });
    if (section.withHistory ?? isOpen) {
      const byUid = section.proposedByUid ?? 'initial';
      const byUsername = section.proposedByUsername ?? 'texto inicial';
      batch.set(ref.collection('private').doc('meta'), {
        version,
        proposedByUid: byUid,
        proposedByUsername: byUsername,
        openAmendment: null,
      });
      for (let n = 1; n <= version; n += 1) {
        const last = n === version;
        batch.set(ref.collection('versions').doc(String(n)), {
          title: last ? title : `${title} (v${n})`,
          text: last ? text : `${text} (v${n})`,
          kind: n === 1 ? 'initial' : 'change',
          amendmentId: null,
          proposedByUid: byUid,
          proposedByUsername: byUsername,
          agreementsCounted: 0,
          authorAgreementCounted: false,
          objectionsResolved: 0,
          objectionsWithdrawn: 0,
          at,
        });
      }
    }
  }
  await batch.commit();
  return { order };
}

export interface SeedDocument {
  id: string;
  title?: string;
  text?: string;
  isArchived?: boolean;
  /** Versión vigente; se siembran `versions/1..version`. */
  version?: number;
  byUid?: string;
  byUsername?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Siembra documentos de la constitución con su historial de versiones. */
export async function seedDocuments(ctx: Ctx, documents: SeedDocument[]): Promise<void> {
  const now = ctx.now();
  const batch = ctx.db.batch();
  for (const item of documents) {
    const title = item.title ?? `Documento ${item.id}`;
    const text = item.text ?? `Texto de ${item.id}.`;
    const version = item.version ?? 1;
    const updatedAt = Timestamp.fromDate(item.updatedAt ?? now);
    const ref = ctx.db.doc(`constitutionDocuments/${item.id}`);
    batch.set(ref, {
      title,
      text,
      createdAt: Timestamp.fromDate(item.createdAt ?? item.updatedAt ?? now),
      updatedAt,
      version,
      isArchived: item.isArchived ?? false,
    });
    for (let n = 1; n <= version; n += 1) {
      const last = n === version;
      batch.set(ref.collection('versions').doc(String(n)), {
        title: last ? title : `${title} (v${n})`,
        text: last ? text : `${text} (v${n})`,
        version: n,
        byUid: item.byUid ?? 'seed',
        byUsername: item.byUsername ?? 'seed',
        at: updatedAt,
      });
    }
  }
  await batch.commit();
}

/** Cuenta suspendida tal como la deja `suspendAccount` (estado, quién y cuándo). */
export async function seedSuspendedAccount(ctx: Ctx, input: Omit<SeedAccount, 'status'> & { suspendedBy?: string }): Promise<{ uid: string }> {
  const account = await seedAccount(ctx, { ...input, status: 'suspended' });
  await ctx.db.doc(`accounts/${account.uid}`).update({ suspendedBy: input.suspendedBy ?? 'seed', suspendedAt: Timestamp.fromDate(ctx.now()) });
  return { uid: account.uid };
}

export interface SeedActor {
  uid: string;
  username: string;
}

/** Contenido anterior que guarda `revisions/{n}` (plan §5.5); se siembran en el orden dado, `n` desde 1. */
export interface SeedRevision {
  title?: string;
  text?: string;
  motive?: string;
  at?: Date;
}

export interface SeedStance {
  uid: string;
  username: string;
  agreement?: AgreementState;
  agreedAtRevision?: number | null;
  agreedAt?: Date | null;
  openObjectionId?: string | null;
  withdrawnReason?: 'inactive' | null;
}

export interface SeedObjection {
  id: string;
  uid: string;
  username: string;
  reason?: string;
  status?: ObjectionStatus;
  openedAt?: Date;
  closedAt?: Date | null;
  resolvedByRevision?: number | null;
  closedBy?: 'author' | 'inactive' | null;
}

export interface SeedEvent {
  kind: string;
  uid?: string;
  username?: string;
  at?: Date;
}

export interface SeedAmendment {
  id: string;
  kind?: AmendmentKind;
  /** Cambiar y quitar. */
  sectionId?: string;
  /** Añadir: id de la sección de referencia o nulo = al principio. */
  after?: string | null;
  author: SeedActor;
  title?: string;
  text?: string;
  motive?: string;
  baseSectionVersion?: number | null;
  openedAt?: Date;
  /** Por omisión, `openedAt` + 360 h. */
  closesAt?: Date;
  extended?: boolean;
  isOpen?: boolean;
  result?: AmendmentResult | null;
  reasons?: CloseReason[];
  closedAt?: Date | null;
  agreementsCounted?: number;
  /** `revisionNo` = 1 + número de revisiones sembradas, salvo que se indique. */
  revisionNo?: number;
  revisions?: SeedRevision[];
  /** Por omisión, un evento `opened` de quien propone. `eventSeq` queda en el número de eventos. */
  events?: SeedEvent[];
  stances?: SeedStance[];
  objections?: SeedObjection[];
  /** Cerradura `amendmentSlots`; por omisión, solo si la propuesta está abierta. */
  withSlot?: boolean;
  /** Marca `private/meta.openAmendment` de la sección (solo cambiar y quitar, abierta, con `private/meta` sembrada). */
  markSection?: boolean;
}

/** Siembra una propuesta con `revisions`, `events`, `stances`, `objections` y cerradura. Devuelve la clave de lugar. */
export async function seedAmendment(ctx: Ctx, input: SeedAmendment): Promise<{ slotKey: string; eventSeq: number }> {
  const kind = input.kind ?? 'change';
  const isOpen = input.isOpen ?? true;
  const openedAt = input.openedAt ?? ctx.now();
  const closesAt = input.closesAt ?? new Date(dueAt(openedAt.getTime()));
  const sectionId = kind === 'add' ? null : (input.sectionId ?? null);
  const after = kind === 'add' ? (input.after ?? null) : null;
  const slotKey = kind === 'add' ? slotKeyOf({ kind, after }) : slotKeyOf({ kind, sectionId: sectionId ?? '' });
  const revisions = input.revisions ?? [];
  const events = input.events ?? [{ kind: 'opened' }];
  const ts = (date: Date): Timestamp => Timestamp.fromDate(date);
  const ref = ctx.db.doc(`amendments/${input.id}`);
  const batch = ctx.db.batch();
  batch.set(ref, {
    kind,
    sectionId,
    after,
    slotKey,
    title: input.title ?? `Propuesta ${input.id}`,
    text: input.text ?? `Texto de la propuesta ${input.id}.`,
    motive: input.motive ?? 'Motivo de la propuesta.',
    revisionNo: input.revisionNo ?? revisions.length + 1,
    baseSectionVersion: input.baseSectionVersion ?? (kind === 'add' ? null : 1),
    authorUid: input.author.uid,
    authorUsername: input.author.username,
    openedAt: ts(openedAt),
    closesAt: ts(closesAt),
    extended: input.extended ?? false,
    isOpen,
    result: isOpen ? null : (input.result ?? 'rejected'),
    reasons: input.reasons ?? [],
    closedAt: isOpen ? null : input.closedAt === undefined ? ts(closesAt) : input.closedAt === null ? null : ts(input.closedAt),
    agreementsCounted: input.agreementsCounted ?? 0,
    objectionsResolved: 0,
    objectionsWithdrawn: 0,
    newSectionId: null,
    eventSeq: events.length,
  });
  revisions.forEach((previous, index) => {
    batch.set(ref.collection('revisions').doc(String(index + 1)), {
      title: previous.title ?? `Título previo ${index + 1}`,
      text: previous.text ?? `Texto previo ${index + 1}.`,
      motive: previous.motive ?? `Motivo previo ${index + 1}.`,
      revisionNo: index + 1,
      at: ts(previous.at ?? openedAt),
    });
  });
  events.forEach((event, index) => {
    batch.set(ref.collection('events').doc(String(index + 1)), {
      seq: index + 1,
      kind: event.kind,
      uid: event.uid ?? input.author.uid,
      username: event.username ?? input.author.username,
      at: ts(event.at ?? openedAt),
    });
  });
  const objectionOf = new Map<string, string>();
  for (const objection of input.objections ?? []) {
    const status = objection.status ?? 'open';
    if (status === 'open') objectionOf.set(objection.uid, objection.id);
    batch.set(ref.collection('objections').doc(objection.id), {
      uid: objection.uid,
      username: objection.username,
      reason: objection.reason ?? 'Motivo de la objeción.',
      status,
      openedAt: ts(objection.openedAt ?? openedAt),
      closedAt: objection.closedAt ? ts(objection.closedAt) : null,
      resolvedByRevision: objection.resolvedByRevision ?? null,
      closedBy: objection.closedBy ?? null,
    });
  }
  const stances = new Map<string, SeedStance>();
  for (const stance of input.stances ?? []) stances.set(stance.uid, stance);
  for (const objection of input.objections ?? []) {
    if (!stances.has(objection.uid)) stances.set(objection.uid, { uid: objection.uid, username: objection.username, agreement: 'none' });
  }
  for (const stance of stances.values()) {
    const agreement = stance.agreement ?? 'active';
    const hasAgreed = agreement !== 'none';
    batch.set(ref.collection('stances').doc(stance.uid), {
      username: stance.username,
      agreement,
      agreedAtRevision: stance.agreedAtRevision === undefined ? (hasAgreed ? 1 : null) : stance.agreedAtRevision,
      agreedAt: stance.agreedAt === undefined ? (hasAgreed ? ts(openedAt) : null) : stance.agreedAt ? ts(stance.agreedAt) : null,
      openObjectionId: stance.openObjectionId === undefined ? (objectionOf.get(stance.uid) ?? null) : stance.openObjectionId,
      withdrawnReason: stance.withdrawnReason ?? null,
    });
  }
  if (input.withSlot ?? isOpen) batch.set(ctx.db.doc(`amendmentSlots/${slotKey}`), { amendmentId: input.id });
  await batch.commit();
  if (sectionId !== null && isOpen && (input.markSection ?? true)) {
    const meta = ctx.db.doc(`constitutionSections/${sectionId}/private/meta`);
    if ((await meta.get()).exists) await meta.update({ openAmendment: { id: input.id, kind, closesAt: ts(closesAt) } });
  }
  return { slotKey, eventSeq: events.length };
}
