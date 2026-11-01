// Invitaciones: vencimiento, clave del correo, estado y orden de la lista.
import { describe, expect, it } from 'vitest';
import {
  INVITATION_DAYS,
  compareInvitations,
  emailKey,
  invitationExpiry,
  invitationState,
  type InvitationDoc,
} from './invitations';
import { normalizeEmail } from './limits';
import { timestampFrom } from './testing/factories';

const issued = new Date('2026-09-01T15:00:00Z');
const doc = (over: Partial<InvitationDoc> = {}): InvitationDoc => ({
  status: 'pending',
  issuedAt: timestampFrom(issued),
  expiresAt: timestampFrom(invitationExpiry(issued)),
  ...over,
});

describe('shared/domain/invitations', () => {
  it('RF-1 (001): la invitación vence a los 30 días exactos', () => {
    expect(INVITATION_DAYS).toBe(30);
    expect(invitationExpiry(issued).toISOString()).toBe('2026-10-01T15:00:00.000Z');
  });

  it('RF-1 (001): los correos se comparan sin mayúsculas ni espacios en los extremos', async () => {
    expect(normalizeEmail(' Ana@X.org ')).toBe('ana@x.org');
    const a = await emailKey(' Ana@X.org ');
    expect(a).toBe(await emailKey('ana@x.org'));
    expect(a).not.toBe(await emailKey('ana@y.org'));
    expect(a).toMatch(/^[0-9a-f]{64}$/); // sirve de id de documento: sin «/» ni el correo en claro
  });

  it('RF-1 (001): una invitación es pendiente, vencida, aceptada o anulada', () => {
    const before = new Date('2026-09-30T15:00:00Z');
    const exact = new Date('2026-10-01T15:00:00Z');
    expect(invitationState(doc(), before)).toBe('pending');
    expect(invitationState(doc(), new Date(exact.getTime() - 1))).toBe('pending');
    expect(invitationState(doc(), exact)).toBe('expired'); // el instante exacto ya venció
    expect(invitationState(doc(), new Date('2027-01-01T00:00:00Z'))).toBe('expired');
    expect(invitationState(doc({ status: 'accepted' }), exact)).toBe('accepted');
    expect(invitationState(doc({ status: 'cancelled' }), before)).toBe('cancelled');
    expect(invitationState(doc({ status: 'cancelled' }), exact)).toBe('cancelled');
  });

  it('RF-1 (001): la lista va de la más reciente a la más antigua', () => {
    const at = (iso: string) => doc({ issuedAt: timestampFrom(new Date(iso)) });
    const list = [at('2026-08-01T00:00:00Z'), at('2026-09-10T00:00:00Z'), at('2026-09-01T00:00:00Z')];
    const sorted = [...list].sort(compareInvitations);
    expect(sorted.map((i) => i.issuedAt.seconds)).toEqual(
      [...list.map((i) => i.issuedAt.seconds)].sort((x, y) => y - x),
    );
  });
});
