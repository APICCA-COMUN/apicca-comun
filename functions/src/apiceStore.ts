// RF-12 (001) · Escritura transaccional del ápice y su versión (D-T5 (001)): cada guardado crea `versions/{n}` con el
// contenido completo y sube `version` del ápice en la misma transacción. Las ops reutilizan estas dos funciones.
// RF-2 (018), D-T7 (018): `saveVersion` cobra el cupo de ediciones como última lectura y lo escribe con el resto.
import type { Transaction } from 'firebase-admin/firestore';
import { writeApiceNotice } from './noticeStore';
import type { ApiceContent, ApiceStatus, Visibility } from '../../shared/domain/apice';
import { displayLocation, type Location, type Point, type Precision } from '../../shared/domain/location';
import type { Ctx } from './context';
import type { SlotCharge } from './rateLimit';
import { ApiError } from './errors';

/** Lo que guarda cada versión: el contenido de la ficha y su estado. */
export type StoredContent = ApiceContent & { status: ApiceStatus };

/** Qué hace un guardado con la ubicación (RF-9 (001)): el punto exacto solo lo lee el servidor. */
export type LocationChange =
  | { mode: 'keep' }
  | { mode: 'remove' }
  | { mode: 'set'; point: Point; precision: Precision }
  | { mode: 'precision'; precision: Precision };

/** Ubicación nueva de un ápice recién creado. */
export interface NewLocation {
  point: Point;
  precision: Precision;
}

/** Quién guarda: uid y nombre de usuario en el momento del guardado. */
export interface Saver {
  uid: string;
  username: string;
}

/** El ápice tal como lo ve la comprobación de una op, leído dentro de la transacción. */
export interface CurrentApice {
  version: number;
  visibility: Visibility;
  isArchived: boolean;
  authorUid: string;
  content: StoredContent;
  /** Ubicación de pantalla vigente; nunca el punto exacto. */
  location: Location | null;
}

export type SaveVersionResult =
  | { ok: true; version: number }
  | { ok: false; current: { version: number; content: StoredContent } };

export interface SaveVersionInput {
  baseVersion: number;
  content: StoredContent;
  /** Qué pasa con la ubicación; por omisión se conserva. */
  location?: LocationChange;
  saver: Saver;
  kind: 'edit' | 'restore';
  /** Solo con `kind: 'restore'`: la versión que se copia. */
  restoredFromN?: number;
  /** Reglas de la op (cuenta, archivo, permisos); corre dentro de la transacción y puede lanzar `ApiError`. */
  check?: (current: CurrentApice) => void;
  /** Cuenta que debe seguir activa al escribir: se relee dentro de la transacción (RF-5 (001)). */
  requireActiveUid?: string;
  /** Si devuelve `true` con la base vigente, no se crea versión y se responde con la vigente (RF-12 (001)). */
  isNoop?: (current: CurrentApice) => boolean;
  /** Lee el cupo dentro de la transacción (última lectura) y devuelve su cobro; no se llama si hay conflicto o no hay cambios (RF-2 (018), D-T7 (018)). */
  charge?: (tx: Transaction) => Promise<SlotCharge>;
}

/** Ids de documento autogenerados, sin leer el azar fuera del contexto. */
const newId = (ctx: Ctx): string => Buffer.from(ctx.random(15)).toString('base64url');

const EXACT_PATH = (id: string, n: number): string => `apices/${id}/versions/${n}/private/exact`;

const CONTENT_KEYS = ['name', 'description', 'axes', 'needs', 'offers', 'status'] as const;

const pickContent = (data: Record<string, unknown>): StoredContent =>
  Object.fromEntries(CONTENT_KEYS.map((key) => [key, data[key]])) as unknown as StoredContent;

const pointOf = (point: Point): Point => ({ lat: point.lat, lng: point.lng });

/**
 * Crea el ápice privado, no archivado, con su versión 1. `charge` lee el cupo dentro de la transacción y lo cobra con la
 * creación (RF-3 (017), D-T3 (017)).
 */
export async function createApiceDoc(
  ctx: Ctx,
  input: { content: StoredContent; author: Saver; location?: NewLocation; charge?: (tx: Transaction) => Promise<() => void> },
): Promise<{ id: string }> {
  const id = newId(ctx);
  const now = ctx.now();
  const { content, author } = input;
  const location = input.location === undefined ? null : displayLocation(input.location.point, input.location.precision);
  await ctx.db.runTransaction(async (tx) => {
    const charge = input.charge === undefined ? null : await input.charge(tx);
    charge?.();
    tx.create(ctx.db.doc(`apices/${id}`), {
      ...content,
      visibility: 'private',
      isArchived: false,
      archive: null,
      authorUid: author.uid,
      authorUsername: author.username,
      createdAt: now,
      updatedAt: now,
      lastEditedByUsername: author.username,
      version: 1,
      location,
      hasLocation: location !== null,
      image: null,
      activeReferenceCount: 0,
    });
    tx.create(ctx.db.doc(`apices/${id}/versions/1`), {
      n: 1,
      content,
      location,
      kind: 'create',
      restoredFromN: null,
      savedByUid: author.uid,
      savedByUsername: author.username,
      savedAt: now,
    });
    if (input.location !== undefined) tx.create(ctx.db.doc(EXACT_PATH(id, 1)), pointOf(input.location.point));
  });
  return { id };
}

/**
 * Guarda `content` como la versión siguiente si `baseVersion` sigue siendo la vigente; si no, no escribe y devuelve
 * el contenido vigente (RF-11 (001)). El autor y la fecha de creación nunca se reescriben.
 */
export async function saveVersion(ctx: Ctx, id: string, input: SaveVersionInput): Promise<SaveVersionResult> {
  const ref = ctx.db.doc(`apices/${id}`);
  return ctx.db.runTransaction(async (tx): Promise<SaveVersionResult> => {
    const snap = await tx.get(ref);
    if (input.requireActiveUid !== undefined) {
      const account = await tx.get(ctx.db.doc(`accounts/${input.requireActiveUid}`));
      if (account.get('status') !== 'active') throw new ApiError('account-suspended');
    }
    if (!snap.exists) throw new ApiError('invalid-request');
    const data = snap.data() as Record<string, unknown>;
    const current: CurrentApice = {
      version: data['version'] as number,
      visibility: data['visibility'] as Visibility,
      isArchived: data['isArchived'] as boolean,
      authorUid: data['authorUid'] as string,
      content: pickContent(data),
      location: (data['location'] as Location | null | undefined) ?? null,
    };
    input.check?.(current);
    if (current.version !== input.baseVersion) {
      return { ok: false, current: { version: current.version, content: current.content } };
    }
    if (input.isNoop?.(current) === true) return { ok: true, version: current.version };
    const change = input.location ?? { mode: 'keep' };
    // Lecturas antes de escribir: el punto exacto vigente solo se lee si hay que copiarlo o reinterpretarlo.
    let exact: Point | null = null;
    if (change.mode === 'precision' && current.location === null) throw new ApiError('invalid-request');
    if (current.location !== null && (change.mode === 'keep' || change.mode === 'precision')) {
      const stored = await tx.get(ctx.db.doc(EXACT_PATH(id, current.version)));
      if (!stored.exists) throw new ApiError('invalid-request');
      exact = pointOf(stored.data() as Point);
    }
    // Quitar la ubicación purga el historial: los puntos exactos y la ubicación de las versiones que la mostraban
    // exacta (RF-2 (016) · 2.2, D-T4 (016)). Lectura antes de cualquier escritura.
    const located = change.mode === 'remove' ? (await tx.get(ref.collection('versions').where('location', '!=', null))).docs : [];
    let location: Location | null;
    if (change.mode === 'remove') location = null;
    else if (change.mode === 'set') {
      exact = pointOf(change.point);
      location = displayLocation(exact, change.precision);
    } else if (exact === null) location = null;
    else location = displayLocation(exact, change.mode === 'precision' ? change.precision : current.location?.precision);
    const applyCharge = input.charge === undefined ? null : await input.charge(tx); // última lectura (D-T7 (018))
    const n = current.version + 1;
    const now = ctx.now();
    applyCharge?.();
    tx.update(ref, { ...input.content, location, hasLocation: location !== null, version: n, updatedAt: now, lastEditedByUsername: input.saver.username });
    if (exact !== null && location !== null) tx.create(ctx.db.doc(EXACT_PATH(id, n)), exact);
    for (const doc of located) {
      tx.delete(ctx.db.doc(EXACT_PATH(id, doc.get('n') as number)));
      if ((doc.get('location') as Location).precision === 'exact') tx.update(doc.ref, { location: null, locationPurged: true });
    }
    tx.create(ctx.db.doc(`apices/${id}/versions/${n}`), {
      n,
      content: input.content,
      location,
      kind: input.kind,
      restoredFromN: input.kind === 'restore' ? (input.restoredFromN ?? null) : null,
      savedByUid: input.saver.uid,
      savedByUsername: input.saver.username,
      savedAt: now,
    });
    writeApiceNotice(tx, ctx, {
      type: 'apice-editado',
      apiceId: id,
      apiceName: input.content.name,
      authorUid: current.authorUid,
      actorUid: input.saver.uid,
      actorUsername: input.saver.username,
      at: now,
    });
    return { ok: true, version: n };
  });
}
