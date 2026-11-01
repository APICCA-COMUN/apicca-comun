// RNF-2 (004), RF-12 (004) · 12.5, D-T7 (004) · Tarea programada que cierra las propuestas vencidas sin que nadie abra el sitio.
// Llama al mismo código que la op `settleAmendments` (`settleAmendment`); el programador de la nube solo la dispara.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { settleDue } from './amendmentStore';
import type { Ctx } from './context';
import { productionCtx } from './runtime';

/** Región de las funciones (D-T2 (001)); no se importa de `index.ts` para no crear un ciclo. */
const REGION = 'us-central1';

/** Cierra todas las vencidas y devuelve cuántas cambiaron (cerradas o ampliadas). */
export async function closeDueAmendments(ctx: Ctx): Promise<number> {
  return settleDue(ctx);
}

export const amendmentCloser = onSchedule({ region: REGION, schedule: 'every 15 minutes' }, async () => {
  await closeDueAmendments(productionCtx());
});
