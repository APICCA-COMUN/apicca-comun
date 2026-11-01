// RF-19 (001), RF-17 (001) · Cuánto le queda hoy a la persona, cuándo se reinicia (hora de Colombia) y si está bloqueada.
import { DAILY_LIMIT, GLOBAL_DAILY_LIMIT, isBlocked, nextReset, remaining } from '../../../shared/domain/generation';
import { requireActor } from '../access';
import type { Ctx } from '../context';
import { countFrom, dayKey, globalDayRef, stateFrom, stateRef, userDayRef } from '../generationStore';

export interface GenerationStatus {
  remaining: number;
  limit: number;
  resetAt: string;
  blockedUntil: string | null;
}

export async function handleGenerationStatus(ctx: Ctx, _payload: Record<string, unknown>, uid: string | null): Promise<GenerationStatus> {
  const actor = await requireActor(ctx, uid);
  const now = ctx.now();
  const day = dayKey(now);
  const [stateSnap, userSnap, globalSnap] = await Promise.all([
    stateRef(ctx, actor.uid).get(),
    userDayRef(ctx, actor.uid, day).get(),
    globalDayRef(ctx, day).get(),
  ]);
  const state = stateFrom(stateSnap.data());
  // Si el tope global se agotó, a nadie le queda ninguna aunque su cupo personal esté intacto.
  const left = Math.min(remaining(countFrom(userSnap.data()), DAILY_LIMIT), remaining(countFrom(globalSnap.data()), GLOBAL_DAILY_LIMIT));
  return {
    remaining: left,
    limit: DAILY_LIMIT,
    resetAt: nextReset(now).toISOString(),
    blockedUntil: isBlocked(state, now) && state.blockedUntil ? state.blockedUntil.toISOString() : null,
  };
}
