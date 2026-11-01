// RF-12 (002) · 12.2, D-T15 (002): cabecera Cache-Control para las imágenes de marca en Firebase Hosting.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../firebase.json'), 'utf8'));

describe('brand-cache · Firebase Hosting', () => {
  it('RF-12 (002) · 12.2: firebase.json fija Cache-Control de un día para /brand/** y conserva la de /assets/**', () => {
    const headers = config.hosting.headers as Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
    expect(headers).toBeDefined();

    const brand = headers.find((entry) => entry.source === '/brand/**');
    expect(brand).toBeDefined();
    const brandCache = brand?.headers.find((h) => h.key === 'Cache-Control');
    expect(brandCache?.value).toBe('public, max-age=86400');

    const assets = headers.find((entry) => entry.source === '/assets/**');
    expect(assets).toBeDefined();
    const assetsCache = assets?.headers.find((h) => h.key === 'Cache-Control');
    expect(assetsCache?.value).toBe('public, max-age=31536000, immutable');
  });
});
