import { describe, expect, it } from 'vitest';
import {
  BLOCK_MS,
  DAILY_LIMIT,
  FAILURE_LIMIT,
  GENERATION_TIMEOUT_MS,
  GLOBAL_DAILY_LIMIT,
  buildImagePrompt,
  colombiaClock,
  initialFailureState,
  isBlocked,
  nextReset,
  recordOutcome,
  remaining,
} from './generation';

describe('tope diario', () => {
  it('RF-19 (001): 3 por persona y 60 en total', () => {
    expect(DAILY_LIMIT).toBe(3);
    expect(GLOBAL_DAILY_LIMIT).toBe(60);
    expect(GENERATION_TIMEOUT_MS).toBe(90_000);
  });

  it('RF-19 (001): restantes con 0, 2 y 3 generaciones, y nunca negativos', () => {
    expect(remaining(0)).toBe(3);
    expect(remaining(2)).toBe(1);
    expect(remaining(3)).toBe(0);
    expect(remaining(7)).toBe(0);
  });

  it('RF-19 (001): el tope global se calcula con el mismo remaining', () => {
    expect(remaining(59, GLOBAL_DAILY_LIMIT)).toBe(1);
    expect(remaining(60, GLOBAL_DAILY_LIMIT)).toBe(0);
  });

  it('RF-19 (001): el reinicio es la medianoche de Colombia desde un reloj en UTC', () => {
    // 23:59 en Colombia = 04:59 UTC del día siguiente: faltan 60 s.
    expect(nextReset(new Date('2026-10-08T04:59:00Z')).toISOString()).toBe('2026-10-08T05:00:00.000Z');
    // 00:00 en Colombia: acaba de reiniciar, el próximo es en 24 h.
    expect(nextReset(new Date('2026-10-08T05:00:00Z')).toISOString()).toBe('2026-10-09T05:00:00.000Z');
    // Mediodía UTC es 07:00 en Colombia.
    expect(nextReset(new Date('2026-10-07T12:00:00Z')).toISOString()).toBe('2026-10-08T05:00:00.000Z');
  });

  it('RF-19 (001): el reinicio cruza fin de mes y de año', () => {
    expect(nextReset(new Date('2026-12-31T20:00:00Z')).toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });

  it('RF-19 (001): la hora del reinicio se expresa en hora de Colombia', () => {
    expect(colombiaClock(new Date('2026-10-08T05:00:00Z'))).toBe('2026-10-08 00:00');
    expect(colombiaClock(new Date('2026-10-08T04:59:00Z'))).toBe('2026-10-07 23:59');
  });
});

describe('política de fallas', () => {
  const t0 = new Date('2026-10-07T12:00:00Z');
  const at = (ms: number): Date => new Date(t0.getTime() + ms);

  it('RF-20 (001): tres fallas seguidas bloquean 15 minutos', () => {
    expect(FAILURE_LIMIT).toBe(3);
    expect(BLOCK_MS).toBe(15 * 60 * 1000);
    let state = initialFailureState();
    state = recordOutcome(state, 'failure', t0);
    state = recordOutcome(state, 'failure', t0);
    expect(isBlocked(state, t0)).toBe(false);
    state = recordOutcome(state, 'failure', t0);
    expect(isBlocked(state, t0)).toBe(true);
    expect(state.blockedUntil?.toISOString()).toBe(at(BLOCK_MS).toISOString());
  });

  it('RF-20 (001): un éxito entre fallas reinicia la cuenta', () => {
    let state = initialFailureState();
    state = recordOutcome(state, 'failure', t0);
    state = recordOutcome(state, 'failure', t0);
    state = recordOutcome(state, 'success', t0);
    state = recordOutcome(state, 'failure', t0);
    state = recordOutcome(state, 'failure', t0);
    expect(isBlocked(state, t0)).toBe(false);
  });

  it('RF-20 (001): el bloqueo termina a los 15 minutos', () => {
    let state = initialFailureState();
    for (let i = 0; i < 3; i += 1) state = recordOutcome(state, 'failure', t0);
    expect(isBlocked(state, at(BLOCK_MS - 1))).toBe(true);
    expect(isBlocked(state, at(BLOCK_MS))).toBe(false);
  });

  it('RF-20 (001): tras el bloqueo la cuenta empieza de cero', () => {
    let state = initialFailureState();
    for (let i = 0; i < 3; i += 1) state = recordOutcome(state, 'failure', t0);
    state = recordOutcome(state, 'failure', at(BLOCK_MS));
    expect(isBlocked(state, at(BLOCK_MS))).toBe(false);
  });

  it('RF-20 (001): recordOutcome no muta el estado recibido', () => {
    const state = initialFailureState();
    recordOutcome(state, 'failure', t0);
    expect(state).toEqual(initialFailureState());
  });
});

describe('buildImagePrompt', () => {
  const base = { name: 'Huerta comunal', description: 'Una huerta compartida en la ladera.', axes: ['alimento', 'agua'] as const };

  it('RF-17 (001): incluye descripción y ejes, y pide una imagen cuadrada pixelada', () => {
    const { prompt, referenceIds } = buildImagePrompt({ ...base, axes: [...base.axes], references: [] });
    expect(prompt).toContain('Una huerta compartida en la ladera.');
    expect(prompt).toContain('Huerta comunal');
    expect(prompt).toContain('alimento');
    expect(prompt).toContain('agua');
    expect(prompt).toMatch(/cuadrada/i);
    expect(prompt).toMatch(/pixel/i);
    expect(referenceIds).toEqual([]);
  });

  it('RF-17 (001): pide un sprite de pixel art retro, sencillo, plano y sobre fondo liso, antes de los datos del ápice', () => {
    const { prompt } = buildImagePrompt({ ...base, axes: [...base.axes], references: [] });
    expect(prompt).toMatch(/sprite/i);
    expect(prompt).toMatch(/pixel art retro de 16 bits/i);
    expect(prompt).toMatch(/minimalista/i);
    expect(prompt).toMatch(/de color planos/i);
    expect(prompt).toMatch(/sin degradados/i);
    expect(prompt).toMatch(/fondo liso/i);
    expect(prompt.indexOf('pixel art')).toBeLessThan(prompt.indexOf('Nombre: Huerta comunal'));
  });

  it('RF-17 (001): funciona sin referencias', () => {
    expect(() => buildImagePrompt({ ...base, axes: [...base.axes], references: [] })).not.toThrow();
  });

  it('RF-17 (001): usa las referencias no quitadas y excluye las quitadas', () => {
    const { prompt, referenceIds } = buildImagePrompt({
      ...base,
      axes: [...base.axes],
      references: [
        { id: 'r1', altText: 'Surcos de maíz', isRemoved: false },
        { id: 'r2', altText: 'Foto retirada', isRemoved: true },
      ],
    });
    expect(referenceIds).toEqual(['r1']);
    expect(prompt).toContain('Surcos de maíz');
    expect(prompt).not.toContain('Foto retirada');
  });
});
