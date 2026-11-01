import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_TRANSITIONS,
  AMENDMENT_TRANSITIONS,
  OBJECTION_TRANSITIONS,
  canTransitionAgreement,
  canTransitionAmendment,
  canTransitionObjection,
} from './transitions';
import type { AmendmentStatus } from './types';

const CLOSES = 1000;
const ALL: AmendmentStatus[] = ['open', 'approved', 'rejected', 'withdrawn'];

describe('transitions · propuesta', () => {
  it('RF-12 (004) · 12.4: aprobar o rechazar solo es posible al vencer; retirar no necesita vencer', () => {
    for (const to of ['approved', 'rejected'] as const) {
      expect(canTransitionAmendment('open', to, { closesAt: CLOSES, now: CLOSES - 1 })).toBe(false);
      expect(canTransitionAmendment('open', to, { closesAt: CLOSES, now: CLOSES })).toBe(true);
    }
    expect(canTransitionAmendment('open', 'withdrawn', { closesAt: CLOSES, now: 0 })).toBe(true);
  });

  it('RF-12 (004) · 12.4: la tabla no tiene más salidas de open que approved, rejected y withdrawn, y la ampliación no es estado', () => {
    expect([...AMENDMENT_TRANSITIONS.open].sort()).toEqual(['approved', 'rejected', 'withdrawn']);
    expect(Object.keys(AMENDMENT_TRANSITIONS).sort()).toEqual([...ALL].sort());
    expect(canTransitionAmendment('open', 'open', { closesAt: CLOSES, now: CLOSES })).toBe(false);
  });

  it('RF-8 (004) · 8.3: una propuesta cerrada o retirada no cambia de estado', () => {
    for (const from of ['approved', 'rejected', 'withdrawn'] as const) {
      expect(AMENDMENT_TRANSITIONS[from]).toEqual([]);
      for (const to of ALL) expect(canTransitionAmendment(from, to, { closesAt: CLOSES, now: CLOSES + 5 })).toBe(false);
    }
  });
});

describe('transitions · objeción y acuerdo', () => {
  it('RF-10 (004) · 10.4: de open solo se pasa a resolved o withdrawn, y de ahí a nada', () => {
    expect([...OBJECTION_TRANSITIONS.open].sort()).toEqual(['resolved', 'withdrawn']);
    expect(OBJECTION_TRANSITIONS.resolved).toEqual([]);
    expect(OBJECTION_TRANSITIONS.withdrawn).toEqual([]);
    expect(canTransitionObjection('open', 'resolved')).toBe(true);
    expect(canTransitionObjection('open', 'withdrawn')).toBe(true);
    expect(canTransitionObjection('resolved', 'open')).toBe(false);
  });

  it('RF-10 (004) · 10.4: el acuerdo se da, se revoca, se retira por inactividad y se puede dar de nuevo', () => {
    expect(canTransitionAgreement('none', 'active')).toBe(true);
    expect(canTransitionAgreement('active', 'revoked')).toBe(true);
    expect(canTransitionAgreement('active', 'withdrawn')).toBe(true);
    expect(canTransitionAgreement('revoked', 'active')).toBe(true);
    expect(canTransitionAgreement('none', 'revoked')).toBe(false);
    expect(AGREEMENT_TRANSITIONS.none).toEqual(['active']);
  });
});
