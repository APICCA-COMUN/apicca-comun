// RF-27 (021) · 27.2, D-T6 (021): el servidor deja de aceptar las operaciones que solo servían a la generación
// de imágenes, a las propuestas y a las referencias. La puerta común las trata como cualquier operación desconocida.
import { describe, expect, it } from 'vitest';
import { API_OPS, handleApi } from './api';
import type { Ctx } from './context';
import { ApiError } from './errors';

/** Las operaciones retiradas: las que tenía `api` y las que tenía la callable `media`. */
const RETIRED = [
  'generateImage',
  'generationStatus',
  'acceptProposal',
  'discardProposal',
  'addReference',
  'readReference',
  'removeReference',
  'retractImage',
  'reserveUpload',
];

// La puerta rechaza la operación antes de usar el contexto: no hace falta ningún emulador.
const ctx = {} as Ctx;

async function codeOf(data: unknown): Promise<string | undefined> {
  try {
    await handleApi(ctx, data, 'uid-1');
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

describe('api · operaciones retiradas', () => {
  for (const op of RETIRED) {
    it(`RF-27 (021) · 27.2: «${op}» responde como operación desconocida`, async () => {
      expect(Object.hasOwn(API_OPS, op)).toBe(false);
      expect(await codeOf({ op, id: 'a1' })).toBe('unknown-op');
    });
  }

  it('RF-27 (021) · 27.2: las operaciones de los ápices siguen registradas', () => {
    for (const op of ['createApice', 'editApice', 'restoreVersion', 'setVisibility', 'archiveApice', 'restoreApice']) {
      expect(Object.hasOwn(API_OPS, op)).toBe(true);
    }
  });
});
