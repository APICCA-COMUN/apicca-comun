// RF-10 (004) · 10.4, RF-12 (004) · 12.6, RNF-1 (004), D-T4 (004) · Retirar una objeción propia. Solo quien objetó.
import type { Ctx } from '../context';
import { closeOwnObjection } from './resolveObjection';

export const handleWithdrawObjection = (ctx: Ctx, payload: Record<string, unknown>, uid: string | null) =>
  closeOwnObjection(ctx, payload, uid, 'withdrawn');
