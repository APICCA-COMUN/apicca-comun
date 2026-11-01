// Direcciones (https:// sin distinguir mayúsculas, algo detrás, hasta 2 000) y validación de
// la lista de enlaces (máximo 10, descripción, tipo).
import { describe, expect, it } from 'vitest';
import { isSafeUrl, validateLinks, validateUrl } from './urls';
import type { Link } from './urls';

describe('shared/domain/urls', () => {
  it('acepta https:// sin distinguir mayúsculas y con algo detrás', () => {
    expect(validateUrl('https://example.org')).toEqual({ ok: true });
    expect(validateUrl('HTTPS://example.org/x')).toEqual({ ok: true });
    expect(validateUrl('Https://a')).toEqual({ ok: true });
    expect(isSafeUrl('HTTPS://example.org')).toBe(true);
  });

  it('rechaza con motivo http://, https:// solo y las que superan 2 000 caracteres', () => {
    expect(validateUrl('http://example.org')).toEqual({ ok: false, reason: expect.stringContaining('https://') });
    expect(validateUrl('https://')).toEqual({ ok: false, reason: expect.stringMatching(/detrás|después/) });
    expect(validateUrl('HTTPS://')).toEqual({ ok: false, reason: expect.stringMatching(/detrás|después/) });
    expect(validateUrl('')).toEqual({ ok: false, reason: expect.stringContaining('https://') });
    expect(validateUrl('javascript:alert(1)')).toEqual({ ok: false, reason: expect.stringContaining('https://') });
    expect(validateUrl('https://' + 'a'.repeat(1_992))).toEqual({ ok: true });
    expect(validateUrl('https://' + 'a'.repeat(1_993))).toEqual({ ok: false, reason: expect.stringContaining('2000') });
    expect(isSafeUrl('http://example.org')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });

  it('la dirección se mide en puntos de código, no en unidades UTF-16', () => {
    expect(validateUrl('https://' + '😀'.repeat(1_992))).toEqual({ ok: true });
  });

  it('rechaza más de 10 enlaces, descripción vacía o larga y tipo desconocido, con motivo', () => {
    const good = (i: number): Link => ({ url: `https://x/${i}`, description: `Enlace ${i}`, kind: 'link' });
    expect(validateLinks(Array.from({ length: 10 }, (_, i) => good(i)))).toEqual({ ok: true, errors: [] });

    const eleven = validateLinks(Array.from({ length: 11 }, (_, i) => good(i)));
    expect(eleven.ok).toBe(false);
    expect(eleven.errors).toEqual([{ index: null, reason: expect.stringContaining('10') }]);

    const bad = validateLinks([
      { url: 'http://x', description: 'Sin https', kind: 'link' },
      { url: 'https://x', description: '   ', kind: 'image' },
      { url: 'https://x', description: 'a'.repeat(201), kind: 'image' },
      { url: 'https://x', description: 'Tipo raro', kind: 'video' as Link['kind'] },
      { url: 'https://x', description: 'Bien', kind: 'image' },
    ]);
    expect(bad.ok).toBe(false);
    expect(bad.errors.map((e) => e.index)).toEqual([0, 1, 2, 3]);
    expect(bad.errors[0]?.reason).toContain('https://');
    expect(bad.errors[1]?.reason).toMatch(/descripci/);
    expect(bad.errors[2]?.reason).toContain('200');
    expect(bad.errors[3]?.reason).toMatch(/tipo/);
  });
});
