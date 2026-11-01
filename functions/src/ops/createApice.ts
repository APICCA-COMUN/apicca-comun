// RF-6 (001), RF-9 (001) · Crear un ápice: privado, en «idea» salvo que se pida otro estado, con su versión 1 y su autoría.
import { INITIAL_APICE_STATUS } from '../../../shared/domain/apice';
import { requireActor } from '../access';
import { createApiceDoc } from '../apiceStore';
import { ApiError } from '../errors';
import type { Ctx } from '../context';
import { readContent, readLocationChange } from './apiceInput';

export async function handleCreateApice(ctx: Ctx, payload: Record<string, unknown>, uid: string | null): Promise<{ id: string }> {
  const actor = await requireActor(ctx, uid);
  const content = readContent(payload, INITIAL_APICE_STATUS);
  const change = readLocationChange(payload['location']);
  if (change.mode === 'precision' || (change.mode === 'keep' && payload['location'] !== undefined)) {
    throw new ApiError('invalid-request');
  }
  const location = change.mode === 'set' ? { location: { point: change.point, precision: change.precision } } : {};
  return createApiceDoc(ctx, { content, author: { uid: actor.uid, username: actor.username }, ...location });
}
