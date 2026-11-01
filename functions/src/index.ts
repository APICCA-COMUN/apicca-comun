// Punto de entrada de las Cloud Functions: exporta `api`, `media` y las tareas programadas (`storageSweep`, `amendmentCloser`, `firestoreBackup`).
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
export { amendmentCloser } from './amendmentCloser';
export { firestoreBackup } from './firestoreBackup';
import { handleApi } from './api';
import { ApiError } from './errors';
import { httpsCodeFor } from './httpsCode';
import { handleMedia } from './media';
import { productionCtx } from './runtime';
import { sweepUploads } from './storageSweep';

/** Región de las callables (D-T2 (001)); coubicada con Firestore `nam5` (T-0.1 (001)). */
export const REGION = 'us-central1';

/** Sal del hash de IP del límite de solicitudes (D-T16 (001)); se carga con `firebase functions:secrets:set`. */
const IP_SALT = defineSecret('IP_HASH_SALT');

/** Llave de OpenRouter para generación de imágenes (D-T22 (001), T-6.8). */
const OPENROUTER_KEY = defineSecret('OPENROUTER_API_KEY');

export const api = onCall({ region: REGION, secrets: [IP_SALT] }, async (request) => {
  try {
    const ctx = { ...productionCtx(), clientIp: request.rawRequest.ip, ipSalt: IP_SALT.value() };
    return await handleApi(ctx, request.data, request.auth?.uid ?? null);
  } catch (error) {
    if (error instanceof ApiError) throw new HttpsError(httpsCodeFor(error.code), error.message, { code: error.code });
    throw error;
  }
});

/** Ops que procesan imágenes (D-T2 (001)): más memoria y tiempo que `api`, por `sharp`. */
export const media = onCall({ region: REGION, memory: '1GiB', timeoutSeconds: 120, secrets: [OPENROUTER_KEY] }, async (request) => {
  try {
    return await handleMedia(productionCtx(OPENROUTER_KEY.value()), request.data, request.auth?.uid ?? null);
  } catch (error) {
    if (error instanceof ApiError) throw new HttpsError(httpsCodeFor(error.code), error.message, { code: error.code });
    throw error;
  }
});

/** Borra los temporales de subida de más de 24 h (D-T9 (001), RNF-7 (001)). */
export const storageSweep = onSchedule({ region: REGION, schedule: 'every 24 hours' }, async () => {
  await sweepUploads(productionCtx());
});
