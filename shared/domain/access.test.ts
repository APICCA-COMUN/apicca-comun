// Quién puede suspender a quién.
import { describe, expect, it } from 'vitest';
import {
  APICE_ACCESS_TABLE,
  APICE_ACTORS,
  APICE_STATES,
  apiceFor,
  canArchive,
  canChangeVisibility,
  canEdit,
  canReadReference,
  canSeeHistory,
  canSetLocation,
  canSuspend,
  canView,
} from './access';

const facilitator = { uid: 'f1', role: 'facilitator' } as const;
const member = { uid: 'm1', role: 'member' } as const;

describe('shared/domain/access', () => {
  it('RF-5 (001): un facilitador puede suspender a una persona inscrita', () => {
    expect(canSuspend(facilitator, member)).toEqual({ ok: true });
  });

  it('RF-5 (001): un facilitador no puede suspender a otro facilitador', () => {
    expect(canSuspend(facilitator, { uid: 'f2', role: 'facilitator' })).toEqual({
      ok: false,
      code: 'cannot-suspend-facilitator',
    });
  });

  it('RF-5 (001): un facilitador no puede suspenderse a sí mismo', () => {
    expect(canSuspend(facilitator, facilitator)).toEqual({ ok: false, code: 'cannot-suspend-self' });
  });

  it('RF-5 (001): una persona inscrita no puede suspender a nadie', () => {
    expect(canSuspend(member, { uid: 'm2', role: 'member' })).toEqual({ ok: false, code: 'forbidden' });
  });
});

describe('shared/domain/access · ápices', () => {
  it('RF-13 (001): la tabla única cubre cada actor en cada estado del ápice', () => {
    expect(APICE_ACCESS_TABLE).toHaveLength(Object.keys(APICE_ACTORS).length * Object.keys(APICE_STATES).length);
  });

  for (const row of APICE_ACCESS_TABLE) {
    const label = `${row.actor} · ${row.state}`;
    const viewer = APICE_ACTORS[row.actor].viewer;
    const apice = apiceFor(row.state, row.actor);

    it(`RF-13 (001): ${label} → ver ${row.view ? 'sí' : 'no'}`, () => {
      expect(canView(viewer, apice)).toBe(row.view);
    });

    it(`RF-10 (001): ${label} → editar ${row.edit ? 'sí' : 'no'}`, () => {
      expect(canEdit(viewer, apice)).toBe(row.edit);
    });

    it(`RF-12 (001): ${label} → historial ${row.history ? 'sí' : 'no'}`, () => {
      expect(canSeeHistory(viewer, apice)).toBe(row.history);
    });

    it(`RF-13 (001): ${label} → cambiar visibilidad ${row.visibility ? 'sí' : 'no'}`, () => {
      expect(canChangeVisibility(viewer, apice)).toBe(row.visibility);
    });

    it(`RF-14 (001): ${label} → archivar o restaurar ${row.archive ? 'sí' : 'no'}`, () => {
      expect(canArchive(viewer, apice)).toBe(row.archive);
    });
  }

  it('RF-14 (001): un ápice archivado no se edita ni lo ve quien solo está inscrito', () => {
    const archived = apiceFor('archived-public', 'member');
    expect(canEdit(APICE_ACTORS.member.viewer, archived)).toBe(false);
    expect(canView(APICE_ACTORS.member.viewer, archived)).toBe(false);
    expect(canView(APICE_ACTORS.author.viewer, apiceFor('archived-public', 'author'))).toBe(true);
  });

  it('RF-22 (001): el ápice de una autora suspendida sigue visible y co-editable por otras personas', () => {
    const apice = { visibility: 'public', isArchived: false, authorUid: 'suspendedAuthor' } as const;
    expect(canView(null, apice)).toBe(true);
    expect(canEdit(APICE_ACTORS.member.viewer, apice)).toBe(true);
    expect(canEdit(APICE_ACTORS.suspendedAuthor.viewer, apice)).toBe(false);
  });
});

describe('shared/domain/access · referencias (spec 007)', () => {
  it('RF-1 (007): una referencia vigente la recibe quien puede ver el ápice, y nadie más', () => {
    for (const r of APICE_ACCESS_TABLE) {
      const { viewer } = APICE_ACTORS[r.actor];
      expect(canReadReference(viewer, apiceFor(r.state, r.actor), false), `${r.actor} · ${r.state}`).toBe(r.view);
    }
  });

  it('RF-2 (007): una referencia quitada solo la recibe un facilitador activo que puede ver el ápice', () => {
    for (const r of APICE_ACCESS_TABLE) {
      const { viewer } = APICE_ACTORS[r.actor];
      const expected = r.view && r.actor === 'facilitator';
      expect(canReadReference(viewer, apiceFor(r.state, r.actor), true), `${r.actor} · ${r.state}`).toBe(expected);
    }
  });
});

describe('shared/domain/access · ubicación (spec 016)', () => {
  const states = Object.keys(APICE_STATES) as (keyof typeof APICE_STATES)[];
  const allowed = new Set(['author', 'facilitator']);
  for (const actor of Object.keys(APICE_ACTORS) as (keyof typeof APICE_ACTORS)[]) {
    it(`RF-1 (016) · 1.1: ${actor} ${allowed.has(actor) ? 'puede' : 'no puede'} fijar o volver exacta la ubicación`, () => {
      for (const state of states) {
        expect(canSetLocation(APICE_ACTORS[actor].viewer, apiceFor(state, actor))).toBe(allowed.has(actor));
      }
    });
  }
});
