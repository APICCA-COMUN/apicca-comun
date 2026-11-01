// T-4.3 (004): crear o editar una sección antes de la apertura (RF-4 (004) · 4.2, RF-1 (004) · 1.4, RF-16 (004)).
import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS } from '../../../shared/domain/limits';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { codeOf } from '../testing/apiceKit';
import { seedConstitution } from '../testing/constitutionKit';
import { handleSaveSection } from './saveSection';

let ctx: TestCtx;
let fabi: string;
let ana: string;

const state = async () => (await ctx.db.doc('constitution/state').get()).data() as Record<string, unknown>;
const section = async (id: string) => (await ctx.db.doc(`constitutionSections/${id}`).get()).data() as Record<string, unknown>;

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
});

describe('saveSection', () => {
  it('RF-4 (004) · 4.2: el facilitador crea secciones antes de abrir y quedan al final del orden, sin versiones', async () => {
    const first = await handleSaveSection(ctx, { title: 'Principios', text: 'Texto uno.' }, fabi);
    ctx.setNow(new Date('2026-09-02T09:00:00Z'));
    const second = await handleSaveSection(ctx, { title: 'Decisiones', text: 'Texto dos.' }, fabi);
    expect(first.id).not.toBe(second.id);
    expect(await section(first.id)).toMatchObject({ title: 'Principios', text: 'Texto uno.', isRetired: false, retiredAt: null });
    expect(await state()).toMatchObject({ isOpen: false, openedAt: null, order: [first.id, second.id] });
    expect(((await state())['updatedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-09-02T09:00:00.000Z');
    expect((await ctx.db.collection(`constitutionSections/${first.id}/versions`).get()).size).toBe(0);
    expect((await ctx.db.doc(`constitutionSections/${first.id}/private/meta`).get()).exists).toBe(false);
  });

  it('RF-4 (004) · 4.2: el facilitador edita una sección existente sin cambiar su lugar', async () => {
    await seedConstitution(ctx, { sections: [{ id: 's1' }, { id: 's2' }] });
    ctx.setNow(new Date('2026-09-03T10:00:00Z'));
    expect(await handleSaveSection(ctx, { id: 's1', title: 'Nuevo título', text: 'Nuevo texto.' }, fabi)).toEqual({ id: 's1' });
    expect(await section('s1')).toMatchObject({ title: 'Nuevo título', text: 'Nuevo texto.' });
    expect(await state()).toMatchObject({ order: ['s1', 's2'] });
    expect(await codeOf(handleSaveSection(ctx, { id: 'nada', title: 'T', text: 'x' }, fabi))).toBe('section-not-found');
  });

  it('RF-1 (004) · 1.4: una persona inscrita recibe forbidden y sin sesión unauthenticated; nada se escribe', async () => {
    expect(await codeOf(handleSaveSection(ctx, { title: 'T', text: 'x' }, ana))).toBe('forbidden');
    expect(await codeOf(handleSaveSection(ctx, { title: 'T', text: 'x' }, null))).toBe('unauthenticated');
    expect((await ctx.db.collection('constitutionSections').get()).size).toBe(0);
  });

  it('RF-1 (004) · 1.4: abierta la constitución, el facilitador recibe constitution-open y la sección no cambia', async () => {
    await seedConstitution(ctx, { isOpen: true, sections: [{ id: 's1', title: 'Uno' }] });
    expect(await codeOf(handleSaveSection(ctx, { id: 's1', title: 'Otro', text: 'x' }, fabi))).toBe('constitution-open');
    expect(await codeOf(handleSaveSection(ctx, { title: 'Nueva', text: 'x' }, fabi))).toBe('constitution-open');
    expect((await section('s1'))['title']).toBe('Uno');
    expect((await ctx.db.collection('constitutionSections').get()).size).toBe(1);
  });

  it('RF-16 (004) · 16.1: título o texto vacíos o de solo espacios se rechazan con text-empty', async () => {
    expect(await codeOf(handleSaveSection(ctx, { title: '  ', text: 'x' }, fabi))).toBe('text-empty');
    expect(await codeOf(handleSaveSection(ctx, { title: 'T', text: '\n ' }, fabi))).toBe('text-empty');
    expect((await ctx.db.collection('constitutionSections').get()).size).toBe(0);
  });

  it('RF-16 (004) · 16.2: un exceso informa los caracteres que sobran', async () => {
    await expect(handleSaveSection(ctx, { title: 'a'.repeat(LIMITS.title + 2), text: 'x' }, fabi)).rejects.toThrow('sobran 2 caracteres');
    await expect(handleSaveSection(ctx, { title: 'T', text: 'a'.repeat(LIMITS.text + 1) }, fabi)).rejects.toThrow('sobra 1 carácter');
  });
});
