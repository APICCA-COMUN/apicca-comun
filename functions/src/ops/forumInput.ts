// RF-3 (009) · 3.1, 3.2, RF-4 (009), RF-6 (009), RF-9 (016) · 9.2 · Lectura común de los datos del foro que llegan en el payload.
import { AXES, type Axis } from '../../../shared/domain/apice';
import { validateMessage, validateThreadTitle } from '../../../shared/domain/forum';
import { ApiError } from '../errors';
import { readSafeId } from '../ids';
import { ConstitutionTextError } from './constitutionInput';

function read(raw: unknown, check: (text: string) => { ok: boolean; reason?: string }): string {
  if (typeof raw !== 'string') throw new ApiError('invalid-request');
  const checked = check(raw);
  if (checked.ok) return raw;
  if (raw.trim().length === 0) throw new ApiError('text-empty');
  const tooLong = checked.reason?.includes('admite hasta') === true;
  throw new ConstitutionTextError(tooLong ? 'text-too-long' : 'invalid-request', checked.reason ?? '');
}

export const readThreadTitle = (raw: unknown): string => read(raw, validateThreadTitle);
export const readForumMessage = (raw: unknown): string => read(raw, validateMessage);

export function readAxis(raw: unknown): Axis {
  if (typeof raw !== 'string') throw new ApiError('invalid-request');
  if (!(AXES as readonly string[]).includes(raw)) throw new ApiError('axis-unknown');
  return raw as Axis;
}

function readIdField(payload: Record<string, unknown>, key: string): string {
  return readSafeId(payload, key);
}

export const readThreadId = (payload: Record<string, unknown>): string => readIdField(payload, 'threadId');
export const readMessageId = (payload: Record<string, unknown>): string => readIdField(payload, 'messageId');
