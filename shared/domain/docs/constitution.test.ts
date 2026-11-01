// Lectura de la constitución (D-T17 (003)): título, principios numerados y nota final.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseConstitution } from './constitution';
import { inlineText } from './markdown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// `docs/constitution.md` es interno y no viaja en el repo público: en la CI no existe (RF-8 (013) v0.5).
const realPath = join(root, 'docs', 'constitution.md');
const hasReal = existsSync(realPath);
const real = hasReal ? readFileSync(realPath, 'utf8') : '';

describe.skipIf(!hasReal)('RF-15 (003) · parseConstitution con el archivo real (D-T17 (003))', () => {
  // El cuerpo de `describe` corre aunque se salte; sin archivo no se lee nada.
  const parsed = hasReal ? parseConstitution(real) : ({} as ReturnType<typeof parseConstitution>);

  it('RF-15 (003) · 15.2: devuelve el título del archivo', () => {
    expect(parsed.title).toBe((real.split('\n')[0] ?? '').replace(/^# /, ''));
  });

  it('RF-15 (003) · 15.2: devuelve tantos principios como elementos numerados tiene el archivo, sin fijar el número', () => {
    const numbered = real.split('\n').filter((l) => /^\d+\. /.test(l));
    expect(parsed.principles.length).toBe(numbered.length);
    expect(parsed.principles.length).toBeGreaterThan(0);
  });

  it('RF-15 (003) · 15.2: los principios van numerados desde 1 y cada uno trae encabezado y texto del archivo', () => {
    const numbered = real.split('\n').filter((l) => /^\d+\. /.test(l));
    parsed.principles.forEach((p, i) => {
      expect(p.number).toBe(i + 1);
      expect(p.heading.length).toBeGreaterThan(0);
      expect(p.heading.endsWith(':')).toBe(false);
      expect(inlineText(p.text).length).toBeGreaterThan(0);
      const line = (numbered[i] ?? '').replace(/^\d+\. /, '').replace(/\*\*/g, '').replace(/`/g, '');
      expect(line).toContain(p.heading);
      expect(line.endsWith(inlineText(p.text))).toBe(true);
    });
  });

  it('RF-15 (003) · 15.2: devuelve la nota final de enmienda', () => {
    expect(parsed.note).not.toBeNull();
    expect(inlineText(parsed.note ?? [])).toMatch(/^Enmendada/);
  });
});

describe('RF-15 (003) · parseConstitution con casos sintéticos (D-T17 (003))', () => {
  const ok = '# Título\n\n1. **Uno:** a\n2. **Dos:** b\n\nNota final.';

  it('RF-15 (003) · 15.2: lee título, principios y nota', () => {
    const p = parseConstitution(ok);
    expect(p.title).toBe('Título');
    expect(p.principles.map((x) => [x.number, x.heading])).toEqual([[1, 'Uno'], [2, 'Dos']]);
    expect(inlineText(p.principles[1]?.text ?? [])).toBe('b');
    expect(inlineText(p.note ?? [])).toBe('Nota final.');
  });

  it('RF-15 (003) · 15.2: sin nota final, note es null', () => {
    expect(parseConstitution('# T\n\n1. **Uno:** a').note).toBeNull();
  });

  it('RF-15 (003) · 15.2: falla si la numeración no empieza en 1', () => {
    expect(() => parseConstitution('# T\n\n2. **Dos:** a\n3. **Tres:** b')).toThrow();
  });

  it('RF-15 (003) · 15.2: falla si la numeración salta un número', () => {
    expect(() => parseConstitution('# T\n\n1. **Uno:** a\n3. **Tres:** b')).toThrow();
  });

  it('RF-15 (003) · 15.2: falla si falta el título', () => {
    expect(() => parseConstitution('1. **Uno:** a')).toThrow();
  });

  it('RF-15 (003) · 15.2: falla si no hay lista numerada', () => {
    expect(() => parseConstitution('# T\n\nSolo texto.')).toThrow();
  });

  it('RF-15 (003) · 15.2: falla si un principio no empieza con un encabezado en negrita', () => {
    expect(() => parseConstitution('# T\n\n1. sin negrita')).toThrow();
  });

  it('RF-15 (003) · 15.2: los errores del convertidor se propagan', () => {
    expect(() => parseConstitution('# T\n\n1. **Uno:** <b>x</b>')).toThrow(/línea 3/);
  });
});
