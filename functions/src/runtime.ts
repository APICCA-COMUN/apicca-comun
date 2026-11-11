// Contexto de producción: las credenciales de la propia función, el reloj y el azar reales.
import { randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Ctx } from './context';

export function productionCtx(): Ctx {
  const app = getApps()[0] ?? initializeApp();
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    now: () => new Date(),
    random: (bytes) => Uint8Array.from(randomBytes(bytes)),
  };
}
