// RF-9 (016) · 9.2, D-T14 (016) · Validación de identificadores que llegan al servidor.
import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { readSafeId } from './ids';
import { readTarget } from './ops/accountStatus';
import { readId } from './ops/apiceInput';
import { readAmendmentId, readCommentId } from './ops/commentAmendment';
import { readMessageId, readThreadId } from './ops/forumInput';
import { readToken } from './ops/mediaInput';
import { handleResolveEnrollment } from './ops/resolveEnrollment';

function expectInvalidRequest(fn: () => unknown): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiError);
  expect((caught as ApiError).code).toBe('invalid-request');
}

describe('ids · readSafeId', () => {
  it('RF-9 (016) · 9.2: acepta un identificador normal y hasta 128 caracteres', () => {
    expect(readSafeId({ id: 'apice_01-abc' }, 'id')).toBe('apice_01-abc');
    const max = 'a'.repeat(128);
    expect(readSafeId({ id: max }, 'id')).toBe(max);
  });

  it('RF-9 (016) · 9.2: rechaza vacío, «.», «..», «a/b», 129 caracteres y valores no-string', () => {
    for (const bad of ['', '.', '..', 'a/b', 'a'.repeat(129), undefined, null, 123, true, {}, ['id']]) {
      expectInvalidRequest(() => readSafeId({ id: bad }, 'id'));
    }
    expectInvalidRequest(() => readSafeId({}, 'id'));
  });

  it('RF-9 (016) · 9.2: readId rechaza «..» y «.» con invalid-request', () => {
    expectInvalidRequest(() => readId({ id: '..' }));
    expectInvalidRequest(() => readId({ id: '.' }));
    expect(readId({ id: 'apice-1' })).toBe('apice-1');
  });

  it('RF-9 (016) · 9.2: los demás lectores de identificadores rechazan «.» y «..»', async () => {
    const facilitatorCtx = {
      db: {
        doc: (path: string) => ({
          get: async () => {
            if (path === 'accounts/fac') return { exists: true, data: () => ({ status: 'active', role: 'facilitator' }) };
            throw new Error(`ruta inesperada: ${path}`);
          },
        }),
      },
    } as never;
    for (const dot of ['.', '..']) {
      expectInvalidRequest(() => readThreadId({ threadId: dot }));
      expectInvalidRequest(() => readMessageId({ messageId: dot }));
      expectInvalidRequest(() => readAmendmentId({ amendmentId: dot }));
      expectInvalidRequest(() => readCommentId({ commentId: dot }));
      expectInvalidRequest(() => readToken({ uploadId: dot }, 'uploadId'));
      await expect(readTarget({} as never, { uid: dot })).rejects.toMatchObject({
        name: 'ApiError',
        code: 'invalid-request',
      });
      await expect(handleResolveEnrollment(facilitatorCtx, { id: dot, decision: 'accept' }, 'fac')).rejects.toMatchObject({
        name: 'ApiError',
        code: 'invalid-request',
      });
    }
  });
});
