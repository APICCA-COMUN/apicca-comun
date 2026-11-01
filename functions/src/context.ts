// Contexto de ejecución de las ops: todo lo que cambia entre producción y pruebas entra por aquí
// (la base, Auth, Storage, el reloj, el azar y el modelo), así que ninguna op lee `Date` ni `crypto`.
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import type { ImageModel } from './model/imageModel';

export interface Ctx {
  db: Firestore;
  auth: Auth;
  storage: Storage;
  now(): Date;
  /** Bytes aleatorios criptográficamente seguros. */
  random(bytes: number): Uint8Array;
  imageModel: ImageModel;
  /** IP de quien llama, si la callable la conoce (límite del formulario público, D-T16 (001)). */
  clientIp?: string | undefined;
  /** Sal del hash de IP; secreto de Functions. */
  ipSalt?: string;
}
