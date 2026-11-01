// T-1.9: la puerta común rechaza lo mal formado antes de aplicar reglas (RNF-5 (001)).
import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { MAX_PAYLOAD_BYTES, dispatch, type OpHandler } from './dispatch';
import { createTestCtx } from './testing';

const echo: OpHandler = async (_ctx, payload) => ({ got: payload });
const ops = { echo };
const ctx = createTestCtx();

async function codeOf(data: unknown): Promise<string | undefined> {
  try {
    await dispatch(ops, data, ctx, null);
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

describe('dispatch', () => {
  it('RNF-5 (001): una op conocida recibe el payload sin la clave op', async () => {
    expect(await dispatch(ops, { op: 'echo', a: 1 }, ctx, 'u1')).toEqual({ got: { a: 1 } });
  });

  it('RNF-5 (001): rechaza una op desconocida, también las heredadas del prototipo', async () => {
    expect(await codeOf({ op: 'nada' })).toBe('unknown-op');
    expect(await codeOf({ op: 'toString' })).toBe('unknown-op');
    expect(await codeOf({ op: 'constructor' })).toBe('unknown-op');
  });

  it('RNF-5 (001): rechaza un payload que no es un objeto o no trae una op de texto', async () => {
    for (const data of [null, undefined, 'echo', 42, ['echo'], {}, { op: 7 }, { op: '' }]) {
      expect(await codeOf(data)).toBe('invalid-request');
    }
  });

  it('RNF-5 (001): rechaza un payload que excede el tamaño máximo', async () => {
    expect(await codeOf({ op: 'echo', text: 'a'.repeat(MAX_PAYLOAD_BYTES) })).toBe('payload-too-large');
    expect(await codeOf({ op: 'echo', text: 'a'.repeat(1000) })).toBeUndefined();
  });

  it('RNF-5 (001): un payload que no se puede serializar es una solicitud inválida', async () => {
    const circular: Record<string, unknown> = { op: 'echo' };
    circular['self'] = circular;
    expect(await codeOf(circular)).toBe('invalid-request');
  });
});

describe('API_OPS · constitución (004)', () => {
  it('RNF-3 (004): las ops de secciones, apertura y documentos están registradas y sin sesión responden unauthenticated', async () => {
    const { handleApi } = await import('./api');
    for (const op of ['saveSection', 'removeSection', 'reorderSections', 'openConstitution', 'saveDocument', 'archiveDocument', 'restoreDocument']) {
      let code: string | undefined;
      try {
        await handleApi(ctx, { op }, null);
      } catch (error) {
        if (error instanceof ApiError) code = error.code;
        else throw error;
      }
      expect(code, op).toBe('unauthenticated');
    }
  });

  it('RNF-3 (004): las once ops de propuestas están registradas y sin sesión responden unauthenticated', async () => {
    const { handleApi } = await import('./api');
    const ops = [
      'openAmendment', 'reviseAmendment', 'withdrawAmendment', 'commentAmendment', 'editComment', 'archiveComment',
      'agreeAmendment', 'revokeAgreement', 'objectAmendment', 'resolveObjection', 'withdrawObjection',
    ];
    for (const op of ops) {
      let code: string | undefined;
      try {
        await handleApi(ctx, { op, amendmentId: 'a1' }, null);
      } catch (error) {
        if (error instanceof ApiError) code = error.code;
        else throw error;
      }
      expect(code, op).toBe('unauthenticated');
    }
  });

  it('RF-12 (004) · 12.5: settleAmendments está registrada y sin sesión responde unauthenticated', async () => {
    const { handleApi } = await import('./api');
    let code: string | undefined;
    try {
      await handleApi(ctx, { op: 'settleAmendments' }, null);
    } catch (error) {
      if (error instanceof ApiError) code = error.code;
      else throw error;
    }
    expect(code).toBe('unauthenticated');
  });
});
