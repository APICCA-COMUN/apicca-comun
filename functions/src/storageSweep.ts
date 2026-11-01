// RNF-7 (001) · Limpieza de temporales de subida (D-T9 (001)): `uploads/` guarda archivos que nadie reclamó.
// No toca `apices/…/references/`: lo aceptado se conserva.
import type { Ctx } from './context';

/** Vida máxima de un temporal. */
export const UPLOAD_TTL_MS = 24 * 3_600_000;

/** Borra los temporales de más de 24 h y devuelve cuántos. */
export async function sweepUploads(ctx: Ctx): Promise<number> {
  const limit = ctx.now().getTime() - UPLOAD_TTL_MS;
  const [files] = await ctx.storage.bucket().getFiles({ prefix: 'uploads/' });
  let deleted = 0;
  for (const file of files) {
    const created = new Date(String(file.metadata['timeCreated'])).getTime();
    if (Number.isNaN(created) || created >= limit) continue;
    await file.delete({ ignoreNotFound: true });
    deleted += 1;
  }
  return deleted;
}
