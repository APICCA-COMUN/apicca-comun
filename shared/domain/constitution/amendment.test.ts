import { describe, expect, it } from 'vitest';
import { checkAgreement, checkObjection, checkProposedContent, isLateAction, slotKeyOf } from './amendment';

describe('amendment · claves de lugar', () => {
  it('RF-6 (004) · 6.4: la clave es s:ID al cambiar y al quitar, y a:ID o a:start al añadir', () => {
    const table = [
      [{ kind: 'change', sectionId: 'sec1' }, 's:sec1'],
      [{ kind: 'remove', sectionId: 'sec2' }, 's:sec2'],
      [{ kind: 'add', after: 'sec3' }, 'a:sec3'],
      [{ kind: 'add', after: null }, 'a:start'],
    ] as const;
    for (const [input, key] of table) expect(slotKeyOf(input)).toBe(key);
  });
});

describe('amendment · contenido propuesto', () => {
  const current = { title: 'Cuidado', text: 'Nos cuidamos.' };

  it('RF-6 (004) · 6.5: rechaza solo la propuesta de cambiar idéntica a la vigente', () => {
    expect(checkProposedContent('change', current, { ...current })).toEqual({ ok: false, reason: 'identical' });
    expect(checkProposedContent('change', current, { title: 'Cuidado mutuo', text: current.text })).toEqual({ ok: true });
    expect(checkProposedContent('change', current, { title: current.title, text: 'Nos cuidamos todas.' })).toEqual({ ok: true });
  });

  it('RF-6 (004) · 6.5: añadir y quitar no se comparan con lo vigente', () => {
    expect(checkProposedContent('add', null, { ...current })).toEqual({ ok: true });
    expect(checkProposedContent('remove', current, { ...current })).toEqual({ ok: true });
  });
});

describe('amendment · posturas', () => {
  it('RF-11 (004) · 11.2: no acuerda quien tiene una objeción abierta ni quien abrió la propuesta', () => {
    const table = [
      [{ isAuthor: false, hasOpenObjection: false }, { ok: true }],
      [{ isAuthor: false, hasOpenObjection: true }, { ok: false, reason: 'open_objection' }],
      [{ isAuthor: true, hasOpenObjection: false }, { ok: false, reason: 'author' }],
    ] as const;
    for (const [input, out] of table) expect(checkAgreement(input)).toEqual(out);
  });

  it('RF-10 (004) · 10.3: no objeta quien tiene acuerdo vigente, quien ya objeta ni quien abrió la propuesta', () => {
    const open = { isAuthor: false, hasActiveAgreement: false, hasOpenObjection: false };
    const table = [
      [open, { ok: true }],
      [{ ...open, hasActiveAgreement: true }, { ok: false, reason: 'active_agreement' }],
      [{ ...open, hasOpenObjection: true }, { ok: false, reason: 'already_objecting' }],
      [{ ...open, isAuthor: true }, { ok: false, reason: 'author' }],
    ] as const;
    for (const [input, out] of table) expect(checkObjection(input)).toEqual(out);
  });
});

describe('amendment · acciones tardías', () => {
  it('RF-12 (004) · 12.6: tras el vencimiento (inclusive) la acción es tardía', () => {
    const table = [
      [999, false],
      [1000, true],
      [1001, true],
    ] as const;
    for (const [now, late] of table) expect(isLateAction(1000, now)).toBe(late);
  });
});
