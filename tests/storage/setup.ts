// Arnés de pruebas de reglas de Cloud Storage. Corre solo dentro de
// `firebase emulators:exec --project demo-apicca` (script `test:emu`), que levanta
// también el emulador de Storage; los puertos son los fijos de firebase.json.
//
// Tres cosas que este arnés no puede hacer de otra manera:
//
//   1. El proyecto es SIEMPRE el de prueba (`demo-apicca`), nunca uno de sonda. Las
//      reglas de Storage que consulten Firestore con `firestore.get` resuelven contra el
//      proyecto del emulador de Firestore, no contra el del arnés: con un proyecto aparte
//      leerían una base vacía. Por eso `createStorageTestEnvironment` no acepta
//      `projectId` y carga además las reglas reales de Firestore, para sembrar y leer en
//      la misma base que verán las reglas.
//   2. Las reglas de Storage del emulador son GLOBALES: `initializeTestEnvironment` las
//      instala con un PUT en el emulador entero, no por proyecto. Cada archivo de prueba
//      carga las suyas en su `beforeAll`; con `fileParallelism: false` (vitest.config.ts)
//      los archivos no se pisan, pero dentro de un mismo archivo hay un solo juego.
//   3. `env.clearStorage()` del SDK borra solo los objetos de la RAÍZ: hace un `listAll()`
//      sobre `ref()` y descarta los `prefixes`, así que `carpeta/archivo` sobrevive a la
//      limpieza. El `clearStorage(env)` de aquí abajo baja por los prefijos y vacía todo.
import { type RulesTestContext, type RulesTestEnvironment, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type FirebaseStorage, type StorageReference, deleteObject, listAll, ref } from 'firebase/storage';
import { PROJECT_ID, readSiteRules } from '../rules/setup';

export { PROJECT_ID };

const storageRulesPath = resolve(import.meta.dirname, '../../storage.rules');

/** Reglas reales de Storage del sitio, las que se despliegan. */
export function readStorageRules(): string {
  return readFileSync(storageRulesPath, 'utf8');
}

/** Parte `host:puerto` en sus dos mitades, con el puerto por defecto si falta. */
function hostAndPort(value: string | undefined, fallbackPort: number): { host: string; port: number } {
  const [host, port] = (value ?? `127.0.0.1:${fallbackPort}`).split(':');
  return { host: host ?? '127.0.0.1', port: Number(port ?? fallbackPort) };
}

interface StorageTestEnvironmentOptions {
  /** Reglas de Storage a cargar; por defecto, storage.rules. */
  rules?: string;
}

export async function createStorageTestEnvironment(
  options: StorageTestEnvironmentOptions = {},
): Promise<RulesTestEnvironment> {
  const firestore = hostAndPort(process.env['FIRESTORE_EMULATOR_HOST'], 8080);
  const storage = hostAndPort(process.env['FIREBASE_STORAGE_EMULATOR_HOST'], 9199);
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { ...firestore, rules: readSiteRules() },
    storage: { ...storage, rules: options.rules ?? readStorageRules() },
  });
}

/**
 * El Storage modular del contexto. `context.storage()` devuelve el objeto compat del
 * SDK; las funciones de `firebase/storage` lo desenvuelven con `getModularInstance`,
 * así que basta con contárselo a TypeScript.
 */
export function storageOf(context: RulesTestContext): FirebaseStorage {
  return context.storage() as unknown as FirebaseStorage;
}

/** Borra la carpeta y todo lo que cuelga de ella, prefijo a prefijo. */
async function deleteTree(folder: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(folder);
  await Promise.all([...items.map((item) => deleteObject(item)), ...prefixes.map((prefix) => deleteTree(prefix))]);
}

/**
 * Vacía el emulador de Storage. Sustituye a `env.clearStorage()`, que solo alcanza la
 * raíz. Sin `bucket` vacía el de por defecto del proyecto, que es el que este arnés usa;
 * quien siembre o lea con otro bucket tiene que nombrarlo.
 */
export function clearStorage(env: RulesTestEnvironment, bucket?: string): Promise<void> {
  return env.withSecurityRulesDisabled((context) =>
    deleteTree(bucket === undefined ? ref(storageOf(context)) : ref(storageOf(context), `gs://${bucket}`)),
  );
}
