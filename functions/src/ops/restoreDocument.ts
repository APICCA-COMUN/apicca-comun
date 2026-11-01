// RF-5 (004) · 5.7 · Restaurar un documento archivado de la constitución: vuelve a la lista, sin versión nueva (D-T12 (004)).
import type { Ctx } from '../context';
import { setDocumentArchived } from './archiveDocument';

export const handleRestoreDocument = (ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> =>
  setDocumentArchived(ctx, payload, uid, false);
