// RNF-1 (001) · Cliente tipado de las callables `api` y `media` (D-T2 (001)). Los errores tipificados
// del servidor llegan como `ApiClientError` con su mensaje en español (RNF-5 (001)).
import { httpsCallable } from 'firebase/functions';
import type { ApiceContent, ApiceStatus, Axis, Visibility } from '../../shared/domain/apice';
import type { AmendmentKind } from '../../shared/domain/constitution';
import type { Precision } from '../../shared/domain/location';
import { isErrorCode, messageFor, type ErrorCode } from '../../shared/domain/messages';
import { firebase } from './firebase';

/** Error tipificado del servidor: `code` es de `messages.ts` y `message` está en español. */
export class ApiClientError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(messageFor(code));
    this.name = 'ApiClientError';
    this.code = code;
  }
}

/** Lo mínimo que se usa de una callable de Firebase. */
export type Callable = (data: Record<string, unknown>) => Promise<{ data: unknown }>;

/** Forma de cada op: su entrada y su salida. */
export type OpMap = Record<string, { in: Record<string, unknown>; out: unknown }>;

export interface OpClient<Ops extends OpMap> {
  call<K extends keyof Ops & string>(op: K, payload: Ops[K]['in']): Promise<Ops[K]['out']>;
}

/** El SDK pone el código tipificado en `details.code`. */
function typedCode(error: unknown): ErrorCode | undefined {
  const details = (error as { details?: { code?: unknown } } | null)?.details;
  return typeof details?.code === 'string' && isErrorCode(details.code) ? details.code : undefined;
}

/** `getCallable` se llama en cada invocación: crear el cliente no inicia Firebase. */
export function createOpClient<Ops extends OpMap>(getCallable: () => Callable): OpClient<Ops> {
  return {
    async call(op, payload) {
      try {
        return (await getCallable()({ ...payload, op })).data as never;
      } catch (error) {
        const code = typedCode(error);
        if (code === undefined) throw error;
        throw new ApiClientError(code);
      }
    },
  };
}

/** Qué hacer con la ubicación al guardar (RF-9 (001)); `keep` no lee el punto exacto guardado. */
export type LocationEdit =
  | { mode: 'keep' }
  | { mode: 'remove' }
  | { mode: 'set'; lat: number; lng: number; precision: Precision }
  | { mode: 'precision'; precision: Precision };

/** Ops de la callable `api`; cada tarea que agrega una op agrega aquí su forma. */
export interface ApiOps extends OpMap {
  invite: { in: { email: string }; out: { link: string } };
  cancelInvitation: { in: { email: string }; out: Record<string, never> };
  resolveEnrollment: {
    in: { id: string; decision: 'accept' | 'discard'; reason?: string };
    out: { link: string } | { accountExists: true } | Record<string, never>;
  };
  suspendAccount: { in: { uid: string }; out: Record<string, never> };
  reactivateAccount: { in: { uid: string }; out: Record<string, never> };
  inspectInvitation: {
    in: { token: string };
    out: { state: 'pending' | 'expired' | 'accepted'; email: string; accountExists: boolean };
  };
  register: {
    in: { token: string; password: string; name: string; username: string };
    out: { uid: string };
  };
  restoreVersion: {
    in: { id: string; n: number; baseVersion: number };
    out:
      | { ok: true; version: number }
      | { ok: false; conflict: true; current: { version: number; content: ApiceContent & { status: ApiceStatus } } };
  };
  createApice: {
    in: {
      name: string;
      description: string;
      axes: Axis[];
      needs: string;
      offers: string;
      status?: ApiceStatus;
      /** Solo `set`; sin el campo, el ápice nace sin ubicación. */
      location?: LocationEdit;
    };
    out: { id: string };
  };
  editApice: {
    in: {
      id: string;
      baseVersion: number;
      content: { name: string; description: string; axes: Axis[]; needs: string; offers: string; status: ApiceStatus };
      /** Sin el campo se conserva la ubicación guardada, igual que con `keep`. */
      location?: LocationEdit;
    };
    out:
      | { ok: true; version: number }
      | { ok: false; conflict: true; current: { version: number; content: ApiceContent & { status: ApiceStatus } } };
  };
  setVisibility: { in: { id: string; visibility: Visibility }; out: Record<string, never> };
  archiveApice: { in: { id: string }; out: Record<string, never> };
  /** Marca como leídos los avisos de la campana (RF-3 (012)). */
  markNoticesSeen: { in: Record<string, never>; out: Record<string, never> };
  openThread: { in: { title: string; axis: string; text: string }; out: { id: string } };
  replyThread: { in: { threadId: string; text: string }; out: { id: string } };
  editMessage: { in: { threadId: string; messageId: string; text: string }; out: Record<string, never> };
  archiveThread: { in: { threadId: string }; out: Record<string, never> };
  archiveMessage: { in: { threadId: string; messageId: string }; out: Record<string, never> };
  restoreApice: { in: { id: string }; out: Record<string, never> };
  /** Quita una referencia sin borrarla; registra quién y cuándo (RF-16 (001)). */
  removeReference: { in: { id: string; refId: string }; out: Record<string, never> };
  /** Retiro por la facilitación, con motivo, en cualquier ápice (RF-16 (001)). */
  retractImage: {
    in: { id: string; refId: string; reason: string };
    out: Record<string, never>;
  };
  /** Cuánto le queda hoy a la persona, cuándo se reinicia y si está bloqueada (RF-19 (001), RF-20 (001)). Fechas en ISO 8601. */
  generationStatus: {
    in: Record<string, never>;
    out: { remaining: number; limit: number; resetAt: string; blockedUntil: string | null };
  };
  /**
   * Acepta la propuesta propia como imagen del ápice (RF-18 (001)). Si el ápice cambió desde que se generó, responde
   * `ok: false` con los avisos y no hace nada; la persona decide y repite con `confirm: true`.
   */
  acceptProposal: {
    in: { id: string; altText: string; confirm?: boolean };
    out: { ok: true } | { ok: false; warnings: ProposalWarning[] };
  };
  /** Elimina la propuesta propia y conserva la imagen del ápice (RF-18 (001)). */
  discardProposal: { in: { id: string }; out: Record<string, never> };
  requestEnrollment: {
    in: { email: string; name: string; message: string; accepted: boolean; website: string };
    out: { received: true };
  };
  // ---- Constitución común (004): RNF-3 (004), RF-17 (004) · 17.1, D-T12 (004). Los errores tipificados
  // (`amendment-limit`, `amendment-closed`, `constitution-open`…) llegan como `ApiClientError` con su mensaje.
  /** Texto inicial (antes de abrir): crea sin `id` o edita con `id`. */
  saveSection: { in: { id?: string; title: string; text: string }; out: { id: string } };
  removeSection: { in: { id: string }; out: Record<string, never> };
  reorderSections: { in: { order: string[] }; out: Record<string, never> };
  /** Reserva una subida a `uploads/{uid}/{uploadId}`: una hora y 30 por día (RF-7 (016) · 7.3). */
  reserveUpload: { in: Record<string, never>; out: { uploadId: string } };
  openConstitution: { in: Record<string, never>; out: Record<string, never> };
  /** Sin `id` crea (versión 1); con `id` edita con `baseVersion` y el conflicto trae lo vigente. */
  saveDocument: {
    in: { id?: string; baseVersion?: number; title: string; text: string };
    out: { ok: true; id: string; version: number } | { ok: false; conflict: true; current: DocumentCurrent };
  };
  archiveDocument: { in: { id: string }; out: Record<string, never> };
  restoreDocument: { in: { id: string }; out: Record<string, never> };
  /** `taken`: ya hay una propuesta abierta para ese lugar; `amendmentId` es la existente (RF-6 (004) · 6.5). */
  openAmendment: {
    in: { kind: AmendmentKind; sectionId?: string; after?: string | null; title?: string; text?: string; motive: string };
    out: { ok: true; id: string } | { ok: false; taken: true; amendmentId: string };
  };
  reviseAmendment: {
    in: { amendmentId: string; baseRevision: number; title?: string; text?: string; motive: string };
    out: { ok: true; revisionNo: number } | { ok: false; conflict: true; current: AmendmentCurrent };
  };
  withdrawAmendment: { in: { amendmentId: string }; out: Record<string, never> };
  commentAmendment: { in: { amendmentId: string; text: string }; out: { id: string } };
  editComment: {
    in: { amendmentId: string; commentId: string; text: string; baseVersion?: number };
    out: { ok: true; version: number } | { ok: false; conflict: true; current: { text: string; version: number } };
  };
  archiveComment: { in: { amendmentId: string; commentId: string }; out: Record<string, never> };
  agreeAmendment: { in: { amendmentId: string }; out: Record<string, never> };
  revokeAgreement: { in: { amendmentId: string }; out: Record<string, never> };
  objectAmendment: { in: { amendmentId: string; reason: string }; out: { objectionId: string } };
  resolveObjection: {
    in: { amendmentId: string; objectionId: string; resolvedByRevision?: number | null };
    out: Record<string, never>;
  };
  withdrawObjection: { in: { amendmentId: string; objectionId: string }; out: Record<string, never> };
  /** Aplica el vencimiento antes de leer (D-T7 (004)); `id` limita a una propuesta. */
  settleAmendments: { in: { id?: string }; out: Record<string, never> };
}

/** Lo vigente de un documento cuando la edición chocó (RF-17 (004) · 17.2). */
export interface DocumentCurrent {
  version: number;
  title: string;
  text: string;
}

/** Lo vigente de una propuesta cuando la revisión chocó (RF-17 (004) · 17.2). */
export interface AmendmentCurrent {
  revisionNo: number;
  title: string;
  text: string;
  motive: string;
}

/** Por qué una propuesta ya no refleja el ápice: cambió el contenido, cambió la imagen o usó una referencia quitada. */
export type ProposalWarning = 'content-changed' | 'image-changed' | 'reference-removed';

/** Ops de la callable `media` (sharp y modelo de imágenes). */
export interface MediaOps extends OpMap {
  /** `uploadId` es el temporal que el cliente ya subió a `uploads/{uid}/{uploadId}` (D-T9 (001)). */
  addReference: { in: { id: string; uploadId: string; altText: string }; out: { refId: string } };
  /** Genera una propuesta de imagen; la propuesta llega por `ProposalSource`, no en la respuesta (RF-17 (001)). */
  generateImage: { in: { id: string }; out: Record<string, never> };
  /** La imagen de una referencia, con sus bytes en base64 (D-T2 (007)). */
  readReference: { in: { id: string; refId: string }; out: { contentType: string; data: string } };
}

const named = (name: 'api' | 'media'): Callable => httpsCallable(firebase().functions, name) as Callable;

export const api = createOpClient<ApiOps>(() => named('api'));
export const media = createOpClient<MediaOps>(() => named('media'));
