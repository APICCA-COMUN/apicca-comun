// T-1.30: el cliente de las callables convierte los errores tipificados en excepciones con su mensaje.
import { describe, expect, it, vi } from 'vitest';
import { messageFor } from '../../shared/domain/messages';
import { ApiClientError, createOpClient, type ApiOps, type Callable } from './api';

type TestOps = {
  invite: { in: { email: string }; out: { link: string } };
  ping: { in: Record<string, never>; out: { ok: true } };
};

/** Error como lo entrega el SDK de Firebase: `code` de HTTPS y `details.code` tipificado. */
const sdkError = (details: unknown) =>
  Object.assign(new Error('internal detail'), { code: 'functions/failed-precondition', details });

describe('createOpClient', () => {
  it('RNF-1 (001): envía { op, ...payload } y devuelve solo el dato de la respuesta', async () => {
    const callable = vi.fn<Callable>().mockResolvedValue({ data: { link: '/registro/abc' } });
    const client = createOpClient<TestOps>(() => callable);
    await expect(client.call('invite', { email: 'a@ejemplo.org' })).resolves.toEqual({ link: '/registro/abc' });
    expect(callable).toHaveBeenCalledWith({ op: 'invite', email: 'a@ejemplo.org' });
  });

  it('RNF-5 (001): un error tipificado llega como excepción con su código y su mensaje en español', async () => {
    const callable: Callable = () => Promise.reject(sdkError({ code: 'account-exists' }));
    const client = createOpClient<TestOps>(() => callable);
    const error = await client.call('invite', { email: 'a@ejemplo.org' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: 'account-exists', message: messageFor('account-exists') });
  });

  it('RNF-5 (001): un error sin código tipificado no se disfraza y no filtra su detalle', async () => {
    const callable: Callable = () => Promise.reject(sdkError({ code: 'inventado' }));
    const client = createOpClient<TestOps>(() => callable);
    const error = await client.call('ping', {}).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ApiClientError);
    expect(error).toBeInstanceOf(Error);
  });

  it('RNF-1 (001): la callable se obtiene al llamar, no al crear el cliente', async () => {
    const factory = vi.fn<() => Callable>(() => () => Promise.resolve({ data: { ok: true } }));
    const client = createOpClient<TestOps>(factory);
    expect(factory).not.toHaveBeenCalled();
    await client.call('ping', {});
    expect(factory).toHaveBeenCalledOnce();
  });
});

describe('ApiOps de la constitución común', () => {
  const clientWith = (data: unknown) => {
    const callable = vi.fn<Callable>().mockResolvedValue({ data });
    return { callable, client: createOpClient<ApiOps>(() => callable) };
  };

  it('RNF-3 (004): una op de secciones y documentos viaja por la callable con su nombre y el conflicto llega tipado', async () => {
    const current = { version: 3, title: 'T', text: 'x' };
    const { callable, client } = clientWith({ ok: false, conflict: true, current });
    const result = await client.call('saveDocument', { id: 'd1', baseVersion: 2, title: 'T', text: 'y' });
    expect(callable).toHaveBeenCalledWith({ op: 'saveDocument', id: 'd1', baseVersion: 2, title: 'T', text: 'y' });
    expect(result).toEqual({ ok: false, conflict: true, current });
  });

  it('RNF-3 (004): abrir una propuesta distingue «abierta» de «lugar ocupado»', async () => {
    const { client } = clientWith({ ok: false, taken: true, amendmentId: 'a9' });
    const result = await client.call('openAmendment', { kind: 'remove', sectionId: 's1', motive: 'ya no sirve' });
    expect(result).toEqual({ ok: false, taken: true, amendmentId: 'a9' });
  });

  it('RF-17 (004) · 17.1: revisar, comentar, acordar y objetar mandan amendmentId', async () => {
    const { callable, client } = clientWith({});
    await client.call('reviseAmendment', { amendmentId: 'a1', baseRevision: 1, title: 'T', text: 'x', motive: 'm' });
    await client.call('commentAmendment', { amendmentId: 'a1', text: 'hola' });
    await client.call('agreeAmendment', { amendmentId: 'a1' });
    await client.call('objectAmendment', { amendmentId: 'a1', reason: 'porque' });
    await client.call('settleAmendments', {});
    expect(callable.mock.calls.map(([payload]) => payload['op'])).toEqual([
      'reviseAmendment',
      'commentAmendment',
      'agreeAmendment',
      'objectAmendment',
      'settleAmendments',
    ]);
    expect(callable.mock.calls.slice(0, 4).every(([payload]) => payload['amendmentId'] === 'a1')).toBe(true);
  });

  it('RF-17 (004) · 17.1: el límite de propuestas abiertas llega como error tipificado con su mensaje', async () => {
    const callable: Callable = () => Promise.reject(sdkError({ code: 'amendment-limit' }));
    const client = createOpClient<ApiOps>(() => callable);
    const error = await client.call('openAmendment', { kind: 'add', motive: 'm', title: 't', text: 'x' }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'amendment-limit', message: messageFor('amendment-limit') });
  });
});
