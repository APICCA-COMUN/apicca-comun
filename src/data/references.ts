// RF-15 (001), RF-16 (001), RNF-2 (007), RF-7 (016) · 7.3 · Lecturas y subida de las referencias de un ápice. Las reglas de Firestore
// deciden quién ve cada documento: quien no facilita pide solo las no quitadas. La imagen la entrega la op
// `readReference` y se pinta desde un `blob:`, sin URLs públicas ni firmadas (D-T3 (007)). La página recibe estas
// fuentes por props para probarse con dobles.
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import type { TimestampLike } from '../../shared/domain/order';
import { api, media, type MediaOps, type OpClient } from './api';
import { firebase } from './firebase';

export interface ReferenceRemoval {
  kind: 'removed' | 'retracted';
  byUsername: string;
  at?: TimestampLike | undefined;
  /** Solo en un retiro de la facilitación. */
  reason?: string | undefined;
}

export interface ReferenceRow {
  id: string;
  altText: string;
  contentType: string;
  bytes: number;
  /** Ruta en Storage: `apices/{id}/references/{refId}`. */
  path: string;
  uploadedByUsername: string;
  isRemoved: boolean;
  removal: ReferenceRemoval | null;
}

export type Unsubscribe = () => void;

export interface ReferenceSource {
  /** `includeRemoved` solo lo pide la facilitación; las reglas rechazan esa consulta a las demás personas. */
  onReferences(
    apiceId: string,
    options: { includeRemoved: boolean },
    callback: (rows: ReferenceRow[]) => void,
    onError?: () => void,
  ): Unsubscribe;
  /** URL local (`blob:`) de la imagen de la referencia `refId` del ápice `apiceId`. */
  readImage(apiceId: string, refId: string): Promise<string>;
}

export interface ReferenceUploader {
  /** Pide la reserva al servidor, sube el archivo a `uploads/{uid}/{uploadId}` y devuelve `uploadId` (D-T9 (001), RF-7 (016) · 7.3). */
  upload(file: File, onProgress: (fraction: number) => void): Promise<string>;
}

/** Pide la imagen a la op y la convierte en una URL local `blob:` (D-T3 (007)). */
export async function readReferenceImage(client: OpClient<MediaOps>, apiceId: string, refId: string): Promise<string> {
  const { contentType, data } = await client.call('readReference', { id: apiceId, refId });
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: contentType }));
}

export const firestoreReferenceSource: ReferenceSource = {
  onReferences: (apiceId, { includeRemoved }, callback, onError) => {
    const references = collection(firebase().db, 'apices', apiceId, 'references');
    // Sin `orderBy`: con el filtro de igualdad pediría un índice compuesto, y son 5 documentos como mucho por ápice.
    const scoped = includeRemoved ? query(references) : query(references, where('isRemoved', '==', false));
    return onSnapshot(
      scoped,
      (snapshot) => callback(snapshot.docs.map((d) => ({ ...(d.data() as Omit<ReferenceRow, 'id'>), id: d.id }))),
      () => onError?.(),
    );
  },
  readImage: (apiceId, refId) => readReferenceImage(media, apiceId, refId),
};

export const storageReferenceUploader: ReferenceUploader = {
  upload: async (file, onProgress) => {
    const { auth, storage } = firebase();
    const uid = auth.currentUser?.uid;
    if (uid === undefined) throw new Error('Sin sesión.');
    // Las reglas de Storage solo admiten la subida con una reserva vigente del servidor (RF-7 (016) · 7.3).
    const { uploadId } = await api.call('reserveUpload', {});
    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef(storage, `uploads/${uid}/${uploadId}`), file, {
        contentType: file.type,
      });
      task.on(
        'state_changed',
        (snapshot) => onProgress(snapshot.totalBytes === 0 ? 0 : snapshot.bytesTransferred / snapshot.totalBytes),
        reject,
        () => resolve(uploadId),
      );
    });
  },
};
