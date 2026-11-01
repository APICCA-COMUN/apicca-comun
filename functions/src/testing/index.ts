// Utillaje de pruebas del servidor: contexto contra los emuladores, reloj fijo, sembrado de datos
// y modelo doble. No entra en la compilación de producción.
import { randomBytes } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { AccountDoc, AccountStatus, Role } from '../../../shared/domain/accounts';
import type { Ctx } from '../context';
import type { ImageModel } from '../model/imageModel';

export const TEST_PROJECT_ID = 'demo-apicca';
const APP_NAME = 'apicca-test';

/** PNG de 1 × 1 píxel: la «imagen» fija del modelo doble. */
const FIXED_IMAGE = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==', 'base64'),
);

/** Modelo doble: devuelve siempre la misma imagen, sin gastar ni salir de la máquina. */
export const fakeImageModel: ImageModel = {
  generate: async () => FIXED_IMAGE,
};

export interface TestCtx extends Ctx {
  /** Fija el instante que devuelve `now()`. */
  setNow(date: Date): void;
}

export function createTestCtx(options: { now?: Date } = {}): TestCtx {
  let current = options.now ?? new Date('2026-09-01T15:00:00Z');
  const app = getApps().some((a) => a.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp({ projectId: TEST_PROJECT_ID, storageBucket: `${TEST_PROJECT_ID}.appspot.com` }, APP_NAME);
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    now: () => new Date(current.getTime()),
    random: (bytes) => Uint8Array.from(randomBytes(bytes)),
    imageModel: fakeImageModel,
    setNow: (date) => {
      current = date;
    },
  };
}

/** Vacía Auth y Firestore del emulador; cada prueba parte de cero. */
export async function clearEmulators(): Promise<void> {
  const firestore = process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
  const auth = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
  const responses = await Promise.all([
    fetch(`http://${firestore}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://${auth}/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`, { method: 'DELETE' }),
  ]);
  for (const response of responses) if (!response.ok) throw new Error(`No se pudo vaciar el emulador: ${response.status}`);
}

export interface SeedAccount {
  email?: string;
  name?: string;
  username: string;
  role?: Role;
  status?: AccountStatus;
}

/** Crea el usuario de Auth y `accounts/{uid}` (y la reserva del nombre de usuario). */
export async function seedAccount(ctx: Ctx, input: SeedAccount): Promise<{ uid: string } & AccountDoc> {
  const email = input.email ?? `${input.username}@ejemplo.org`;
  const user = await ctx.auth.createUser({ email, password: 'contraseña-de-prueba' });
  const account: AccountDoc = {
    email,
    name: input.name ?? input.username,
    username: input.username,
    role: input.role ?? 'member',
    status: input.status ?? 'active',
  };
  await ctx.db.doc(`accounts/${user.uid}`).set(account);
  await ctx.db.doc(`usernames/${input.username}`).set({ uid: user.uid });
  return { uid: user.uid, ...account };
}
