// T-2 (007): la imagen de una referencia llega por la op `readReference` y se pinta desde un `blob:` (D-T3 (007)).
import { describe, expect, it } from 'vitest';
import type { MediaOps, OpClient } from './api';
import { readReferenceImage } from './references';

describe('src/data/references · readReferenceImage', () => {
  it('RNF-2 (007): pide la imagen a la op y devuelve una URL local `blob:` con sus bytes, sin URL pública ni firmada', async () => {
    const calls: unknown[] = [];
    const client = {
      async call(op: string, payload: unknown) {
        calls.push([op, payload]);
        return { contentType: 'image/png', data: Buffer.from([1, 2, 3]).toString('base64') };
      },
    } as OpClient<MediaOps>;

    const url = await readReferenceImage(client, 'a1', 'r1');

    expect(calls).toEqual([['readReference', { id: 'a1', refId: 'r1' }]]);
    expect(url.startsWith('blob:')).toBe(true);
    const blob = await (await fetch(url)).blob();
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
    URL.revokeObjectURL(url);
  });

  it('RF-5 (007): si la op rechaza, la lectura falla', async () => {
    const client = {
      async call() {
        throw new Error('reference-not-found');
      },
    } as unknown as OpClient<MediaOps>;
    await expect(readReferenceImage(client, 'a1', 'r1')).rejects.toThrow();
  });
});
