// RF-8 (016) · 8.1: el hash del token de invitación (D-T10 (016)).
import { describe, expect, it } from 'vitest';
import { hashToken } from './invitationToken';

describe('invitationToken · hashToken', () => {
  it('RF-8 (016) · 8.1: es determinista y da SHA-256 en 64 caracteres hexadecimales', () => {
    const token = 'abcDEF123_-abcDEF123_-abcDEF1234';
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    // Valor conocido de SHA-256("abc").
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('RF-8 (016) · 8.1: el hash es distinto del token y distintos tokens dan distintos hashes', () => {
    expect(hashToken('uno')).not.toBe('uno');
    expect(hashToken('uno')).not.toBe(hashToken('dos'));
  });
});
