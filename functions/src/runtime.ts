// Contexto de producción: las credenciales de la propia función, el reloj y el azar reales.
// El modelo real usa OpenRouter (D-T22 (001), T-6.8) con la llave inyectada desde Secret Manager.
import { randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Ctx } from './context';
import { createOpenRouterImageModel } from './model/openRouterImageModel';

export const OPENROUTER_MODEL_ID = 'black-forest-labs/flux.2-klein-4b';

export function productionCtx(openRouterApiKey?: string): Ctx {
  const app = getApps()[0] ?? initializeApp();
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    now: () => new Date(),
    random: (bytes) => Uint8Array.from(randomBytes(bytes)),
    imageModel: openRouterApiKey
      ? createOpenRouterImageModel({ apiKey: openRouterApiKey, model: OPENROUTER_MODEL_ID })
      : {
          generate: async () => {
            throw new Error('El modelo de imágenes no tiene configurada la llave de OpenRouter.');
          },
        },
  };
}
