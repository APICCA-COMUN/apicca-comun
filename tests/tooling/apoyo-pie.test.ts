// RNF-1 (015) · 1.1, D-T1 (015), D-T2 (015): el logo de MangleRojo se publica idéntico al oficial
// (`logo-mr-sin-lema-negativo.svg` del sistema de diseño de MangleRojo). La CI no tiene ese repositorio, así que
// se compara con su SHA-256.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const OFFICIAL_SHA256 = '1cf0938dbf1b57926d01a499cf5d544e20ca62d9b5d87e2845a9cb52d382392e';
const file = resolve(import.meta.dirname, '../../public/brand/manglerojo-sin-lema-negativo.svg');

describe('logo de MangleRojo en el pie (015)', () => {
  it('RNF-1 (015) · 1.1: el SVG publicado es idéntico byte a byte al oficial', () => {
    expect(existsSync(file), 'falta public/brand/manglerojo-sin-lema-negativo.svg').toBe(true);
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(OFFICIAL_SHA256);
  });
});
