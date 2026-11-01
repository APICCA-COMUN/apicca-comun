import { describe, expect, it } from 'vitest';
import { evaluateClose, type CloseCounts } from './threshold';

const base: CloseCounts = { activeAccounts: 3, otherAgreements: 1, openObjections: 0, authorActive: true, alreadyExtended: false };
const counts = (over: Partial<CloseCounts>): CloseCounts => ({ ...base, ...over });

describe('threshold · umbral de cierre', () => {
  it('RF-12 (004) · 12.1: con 1 cuenta activa ninguna propuesta se aprueba', () => {
    const out = evaluateClose(counts({ activeAccounts: 1, otherAgreements: 0 }));
    expect(out.result).not.toBe('approved');
    expect(out.reasons).toContain('insufficient_agreements');
    expect(evaluateClose(counts({ activeAccounts: 1, otherAgreements: 0, alreadyExtended: true })).result).toBe('rejected');
  });

  it('RF-12 (004) · 12.1: con 3 y 4 cuentas activas bastan 2 acuerdos (el de quien propone y uno ajeno)', () => {
    for (const activeAccounts of [3, 4]) {
      const out = evaluateClose(counts({ activeAccounts, otherAgreements: 1 }));
      expect(out).toMatchObject({ result: 'approved', reasons: [], agreementsCounted: 2, authorAgreementCounted: true });
      expect(evaluateClose(counts({ activeAccounts, otherAgreements: 0 })).result).toBe('extended');
    }
  });

  it('RF-12 (004) · 12.1: con 5 cuentas activas bastan 3 acuerdos y 2 no alcanzan', () => {
    expect(evaluateClose(counts({ activeAccounts: 5, otherAgreements: 2 })).result).toBe('approved');
    const short = evaluateClose(counts({ activeAccounts: 5, otherAgreements: 1 }));
    expect(short.result).toBe('extended');
    expect(short.reasons).toEqual(['insufficient_agreements']);
  });

  it('RF-12 (004) · 12.1: una objeción abierta impide aprobar aunque sobren acuerdos', () => {
    const out = evaluateClose(counts({ activeAccounts: 3, otherAgreements: 2, openObjections: 1 }));
    expect(out.result).toBe('extended');
    expect(out.reasons).toEqual(['open_objection']);
  });

  it('RF-12 (004) · 12.1: sin acuerdo ajeno no aprueba aunque el doble de los contados alcance', () => {
    const out = evaluateClose(counts({ activeAccounts: 2, otherAgreements: 0 }));
    expect(out.result).toBe('extended');
    expect(out.reasons).toEqual(['insufficient_agreements']);
  });

  it('RF-11 (004) · 11.3: el acuerdo implícito de quien propone cuenta desde la apertura, sin postura propia', () => {
    const out = evaluateClose(counts({ activeAccounts: 4, otherAgreements: 1 }));
    expect(out.agreementsCounted).toBe(2);
    expect(out.authorAgreementCounted).toBe(true);
  });

  it('RF-14 (004) · 14.7: con la cuenta de quien propone suspendida su acuerdo no suma', () => {
    const out = evaluateClose(counts({ activeAccounts: 3, otherAgreements: 1, authorActive: false }));
    expect(out).toMatchObject({ result: 'extended', agreementsCounted: 1, authorAgreementCounted: false });
    expect(evaluateClose(counts({ activeAccounts: 3, otherAgreements: 2, authorActive: false })).result).toBe('approved');
  });

  it('RF-14 (004) · 14.8: al reactivarse la cuenta de quien propone su acuerdo vuelve a sumar', () => {
    const suspended = evaluateClose(counts({ activeAccounts: 3, otherAgreements: 1, authorActive: false }));
    const reactivated = evaluateClose(counts({ activeAccounts: 3, otherAgreements: 1, authorActive: true }));
    expect(suspended.result).toBe('extended');
    expect(reactivated.result).toBe('approved');
  });

  it('RF-12 (004) · 12.2: una propuesta ya ampliada no vuelve a ampliarse', () => {
    const out = evaluateClose(counts({ otherAgreements: 0, alreadyExtended: true }));
    expect(out.result).toBe('rejected');
  });

  it('RF-12 (004) · 12.3: cierra como no aprobada con ambos motivos', () => {
    const out = evaluateClose(counts({ activeAccounts: 5, otherAgreements: 0, openObjections: 2, alreadyExtended: true }));
    expect(out).toMatchObject({ result: 'rejected', reasons: ['insufficient_agreements', 'open_objection'] });
  });
});
