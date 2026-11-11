// Punto de entrada de las Cloud Functions: exporta `api` y las tareas programadas (`storageSweep`, `amendmentCloser`, `firestoreBackup`).
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
export { amendmentCloser } from './amendmentCloser';
export { firestoreBackup } from './firestoreBackup';
import { handleApi } from './api';
import { clientIpOf } from './clientIp';
import { ApiError } from './errors';
import { httpsCodeFor } from './httpsCode';
import { productionCtx } from './runtime';
import { sweepUploads } from './storageSweep';

/** Región de las callables (D-T2 (001)); coubicada con Firestore `nam5` (T-0.1 (001)). */
export const REGION = 'us-central1';

/** Sal del hash de IP del límite de solicitudes (D-T16 (001)); se carga con `firebase functions:secrets:set`. */
const IP_SALT = defineSecret('IP_HASH_SALT');

/** `api`: 10 instancias como máximo (RF-3 (016) · 3.1, D-T6 (016)); la IP sale de `clientIpOf` (RF-4 (016)). */
export const api = onCall({ region: REGION, maxInstances: 10, secrets: [IP_SALT] }, async (request) => {
  try {
    const ctx = { ...productionCtx(), clientIp: clientIpOf(request.rawRequest), ipSalt: IP_SALT.value() };
    return await handleApi(ctx, request.data, request.auth?.uid ?? null);
  } catch (error) {
    if (error instanceof ApiError) throw new HttpsError(httpsCodeFor(error.code), error.message, { code: error.code });
    throw error;
  }
});

/** Borra los temporales de subida de más de 24 h (D-T9 (001), RNF-7 (001)). */
export const storageSweep = onSchedule({ region: REGION, schedule: 'every 24 hours' }, async () => {
  await sweepUploads(productionCtx());
});
