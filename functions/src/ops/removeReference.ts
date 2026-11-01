// RF-16 (001) · Una persona inscrita quita una referencia: deja de mostrarse y se conserva.
import type { Ctx } from '../context';
import { removeAs } from './referenceRemoval';

export const handleRemoveReference = (ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<Record<string, never>> =>
  removeAs(ctx, payload, uid, 'removed');
