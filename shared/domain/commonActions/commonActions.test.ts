// T-2 (010) · Dominio de las Acciones Comunes: límites, validadores, permisos, orden y consultas (RNF-1 (010), D-T2 (010)).
import { describe, expect, it } from 'vitest';
import {
  COMMON_ACTION_LIMITS,
  canJoin,
  canLeave,
  canManage,
  canArchive,
  commonActionsQuery,
  isListed,
  missingForPath,
  sortCommonActions,
  validateActionApiceIds,
  validateActionDescription,
  validateActionTitle,
  type CommonActionState,
} from '.';

const open: CommonActionState = { status: 'abierta', authorUid: 'ana', authorSuspended: false };
const ana = { uid: 'ana', role: 'member' as const, status: 'active' as const };
const beto = { uid: 'beto', role: 'member' as const, status: 'active' as const };
const fabi = { uid: 'fabi', role: 'facilitator' as const, status: 'active' as const };
const susi = { uid: 'susi', role: 'member' as const, status: 'suspended' as const };

describe('Acciones Comunes · límites y validadores', () => {
  it('RF-1 (010) · 1.1, D-3 (010), D-4 (010), D-6 (010): los límites de la spec', () => {
    expect(COMMON_ACTION_LIMITS).toEqual(
      expect.objectContaining({ titleMin: 3, title: 80, descriptionMin: 10, description: 2000, apicesMin: 3, apicesMax: 10, openPerAuthor: 20, pageSize: 24 }),
    );
  });

  it('RF-1 (010) · 1.1, 1.2: el título va de 3 a 80 caracteres y el motivo nombra el límite', () => {
    expect(validateActionTitle('Riego')).toEqual({ ok: true });
    expect(validateActionTitle('ab').reason).toContain('3');
    expect(validateActionTitle('a'.repeat(81)).reason).toContain('80');
    expect(validateActionTitle('   ').ok).toBe(false);
  });

  it('RF-1 (010) · 1.1, 1.2: la descripción va de 10 a 2000 caracteres', () => {
    expect(validateActionDescription('Juntemos agua lluvia.')).toEqual({ ok: true });
    expect(validateActionDescription('corta').reason).toContain('10');
    expect(validateActionDescription('a'.repeat(2001)).reason).toContain('2000');
  });

  it('RF-1 (010) · 1.3, RF-4 (010) · 4.1: de 3 a 10 ápices, sin repetidos', () => {
    expect(validateActionApiceIds(['a', 'b', 'c'])).toEqual({ ok: true });
    expect(validateActionApiceIds(['a', 'b'])).toEqual({ ok: false, code: 'action-apices-min' });
    expect(validateActionApiceIds(['a', 'b', 'b'])).toEqual({ ok: false, code: 'action-apices-min' });
    expect(validateActionApiceIds(Array.from({ length: 11 }, (_, i) => `a${i}`))).toEqual({ ok: false, code: 'action-apices-max' });
  });

  it('RF-19 (021) · 19.2: cuántos ápices faltan para el mínimo', () => {
    expect(missingForPath(0)).toBe(3);
    expect(missingForPath(2)).toBe(1);
    expect(missingForPath(5)).toBe(0);
  });
});

describe('Acciones Comunes · permisos', () => {
  it('RF-2 (010) · 2.2: se suma una cuenta activa a una abierta; no a una cerrada ni archivada', () => {
    expect(canJoin(beto, open)).toBe(true);
    expect(canJoin(null, open)).toBe(false);
    expect(canJoin(susi, open)).toBe(false);
    expect(canJoin(beto, { ...open, status: 'cerrada' })).toBe(false);
    expect(canJoin(beto, { ...open, status: 'archivada' })).toBe(false);
  });

  it('RF-3 (010) · 3.1: la autora no se retira mientras esté abierta; otra participante sí', () => {
    expect(canLeave(beto, open)).toBe(true);
    expect(canLeave(ana, open)).toBe(false);
    expect(canLeave(ana, { ...open, status: 'cerrada' })).toBe(true);
    expect(canLeave(null, open)).toBe(false);
  });

  it('RF-7 (010) · 7.1: la autora cambia la suya; un facilitador solo archiva la ajena', () => {
    expect(canManage(ana, open)).toBe(true);
    expect(canManage(beto, open)).toBe(false);
    expect(canManage(fabi, open)).toBe(false);
    expect(canManage(ana, { ...open, status: 'archivada' })).toBe(false);
    expect(canArchive(fabi, open)).toBe(true);
    expect(canArchive(ana, open)).toBe(true);
    expect(canArchive(beto, open)).toBe(false);
    expect(canArchive(fabi, { ...open, status: 'archivada' })).toBe(false);
  });

  it('RF-8 (010), RF-9 (010), D-T1 (010): se lista si no está archivada y la autora no está suspendida', () => {
    expect(isListed(open)).toBe(true);
    expect(isListed({ ...open, status: 'cerrada' })).toBe(true);
    expect(isListed({ ...open, status: 'archivada' })).toBe(false);
    expect(isListed({ ...open, authorSuspended: true })).toBe(false);
  });
});

describe('Acciones Comunes · orden y consultas', () => {
  it('RF-5 (010): las abiertas primero y la más reciente primero, sin alterar la lista recibida', () => {
    const items = [
      { id: 'c1', status: 'cerrada' as const, createdAt: 5 },
      { id: 'a1', status: 'abierta' as const, createdAt: 1 },
      { id: 'a2', status: 'abierta' as const, createdAt: 3 },
      { id: 'c2', status: 'cerrada' as const, createdAt: 9 },
    ];
    expect(sortCommonActions(items).map((item) => item.id)).toEqual(['a2', 'a1', 'c2', 'c1']);
    expect(items[0]!.id).toBe('c1');
  });

  it('RF-5 (010), RF-6 (010), D-T5 (010): la lista pide las listadas por fecha; «Lo mío» suma la participación', () => {
    expect(commonActionsQuery(null)).toEqual({
      collection: 'commonActions',
      conditions: [{ field: 'isListed', op: '==', value: true }],
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: COMMON_ACTION_LIMITS.mapLimit,
    });
    expect(commonActionsQuery('ana').conditions).toEqual([
      { field: 'isListed', op: '==', value: true },
      { field: 'participantUids', op: 'array-contains', value: 'ana' },
    ]);
  });
});
