// Adaptador de OpenRouter (D-T22 (001)) probado con un `fetch` falso: sin red ni llaves.
import { describe, expect, it } from 'vitest';
import { ImageModelError, type ImageModel } from './imageModel';
import { createOpenRouterImageModel } from './openRouterImageModel';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

type Reply = { status?: number; body?: unknown };
function fakeFetch(reply: Reply) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200 }));
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const make = (f: typeof fetch, extra: { timeoutMs?: number } = {}): ImageModel =>
  createOpenRouterImageModel({ apiKey: 'sk-prueba', model: 'proveedor/modelo', fetch: f, ...extra });

const kindOf = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.catch((err: unknown) => err);
  expect(e).toBeInstanceOf(ImageModelError);
  return (e as ImageModelError).kind;
};

describe('openRouterImageModel', () => {
  const request = { prompt: 'una huerta', references: [] as Uint8Array[] };

  it('RF-17 (001): envía modelo, texto y referencias como data URL y devuelve los bytes', async () => {
    const { fn, calls } = fakeFetch({ body: { data: [{ b64_json: b64(PNG), media_type: 'image/png' }] } });
    const out = await make(fn).generate({ prompt: 'una huerta', references: [PNG] });
    expect([...out]).toEqual([...PNG]);
    const call = calls[0];
    expect(call?.url).toBe('https://openrouter.ai/api/v1/images');
    expect((call?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-prueba');
    const body = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
    expect(body['model']).toBe('proveedor/modelo');
    expect(body['prompt']).toBe('una huerta');
    expect(body['aspect_ratio']).toBe('1:1');
    expect(body['input_references']).toEqual([{ type: 'image_url', image_url: { url: `data:image/png;base64,${b64(PNG)}` } }]);
  });

  it('RF-17 (001): sin referencias no envía input_references', async () => {
    const { fn, calls } = fakeFetch({ body: { data: [{ b64_json: b64(PNG) }] } });
    await make(fn).generate(request);
    expect(JSON.parse(String(calls[0]?.init.body))).not.toHaveProperty('input_references');
  });

  it('RF-20 (001): sin imagen en la respuesta es «empty»', async () => {
    expect(await kindOf(make(fakeFetch({ body: { data: [] } }).fn).generate(request))).toBe('empty');
    expect(await kindOf(make(fakeFetch({ body: { data: [{ b64_json: '' }] } }).fn).generate(request))).toBe('empty');
  });

  it('RF-20 (001): 400 es «rejected»; 402, 429, 500 y 502 son «failure»; 524 es «timeout»', async () => {
    for (const [status, kind] of [[400, 'rejected'], [402, 'failure'], [429, 'failure'], [500, 'failure'], [502, 'failure'], [524, 'timeout']] as const) {
      expect(await kindOf(make(fakeFetch({ status, body: { error: { code: status, message: 'x' } } }).fn).generate(request)), String(status)).toBe(kind);
    }
  });

  it('RF-4 (013) · 4.1: al agotarse el tope de crédito (402), la falla es la del proveedor', async () => {
    const { fn } = fakeFetch({ status: 402, body: { error: { message: 'Insufficient credits' } } });
    expect(await kindOf(make(fn).generate(request))).toBe('failure');
  });

  it('RF-20 (001): un fallo de red es «failure»', async () => {
    const boom = (() => Promise.reject(new TypeError('red caída'))) as unknown as typeof fetch;
    expect(await kindOf(make(boom).generate(request))).toBe('failure');
  });

  it('RF-20 (001): si no responde a tiempo es «timeout»', async () => {
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')));
      })) as unknown as typeof fetch;
    expect(await kindOf(make(hang, { timeoutMs: 20 }).generate(request))).toBe('timeout');
  });

  it('RNF-5 (001): la llave no aparece en los mensajes de error', async () => {
    const e = await make(fakeFetch({ status: 401, body: { error: { message: 'sk-prueba inválida' } } }).fn)
      .generate(request)
      .catch((err: unknown) => err);
    expect(String((e as Error).message)).not.toContain('sk-prueba');
  });
});
