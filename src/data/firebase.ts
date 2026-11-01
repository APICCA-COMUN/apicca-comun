// Inicio de la app de Firebase y conexión a emuladores en desarrollo. Todo es perezoso:
// importar este módulo no inicia nada hasta que alguien pide Auth, Firestore o Functions.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { emulatorLane } from './emulatorPorts';

/** Región de las callables; debe coincidir con `REGION` de `functions/src/index.ts` (D-T2 (001)). */
export const FUNCTIONS_REGION = 'us-central1';

/** Solo en desarrollo y solo si se pide con `VITE_USE_EMULATORS=true`: nunca en una compilación de producción. */
export function shouldUseEmulators(env: { DEV: boolean; VITE_USE_EMULATORS?: string }): boolean {
  return env.DEV && env.VITE_USE_EMULATORS === 'true';
}

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

let services: Services | undefined;

/** Los puertos son los de `firebase.json`, o los de `firebase.paralelo.json` con `VITE_EMULATOR_LANE=par`. */
function connectEmulators({ auth, db, functions, storage }: Services, lane: string | undefined): void {
  const { ports } = emulatorLane(lane);
  connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', ports.firestore);
  connectFunctionsEmulator(functions, '127.0.0.1', ports.functions);
  connectStorageEmulator(storage, '127.0.0.1', ports.storage);
}

export function firebase(): Services {
  if (services) return services;
  const env = import.meta.env;
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-apicca.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-apicca',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-apicca.appspot.com',
    appId: env.VITE_FIREBASE_APP_ID ?? 'demo-app',
  });
  const useEmu = shouldUseEmulators({ DEV: env.DEV, VITE_USE_EMULATORS: env.VITE_USE_EMULATORS });
  const created: Services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    functions: getFunctions(app, FUNCTIONS_REGION),
    storage: getStorage(app),
  };
  if (useEmu) connectEmulators(created, env.VITE_EMULATOR_LANE);
  services = created;
  return created;
}
