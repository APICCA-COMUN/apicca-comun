// Solicitudes de inscripción: validación, listas y descarte.
import { describe, expect, it } from 'vitest';
import {
  ENROLLMENT_TTL_DAYS,
  isEnrollmentExpired,
  PRIVACY_TEXT_VERSION,
  splitEnrollmentLists,
  validateDiscardReason,
  validateEnrollmentRequest,
  type EnrollmentDoc,
} from './enrollment';
import { timestampFrom } from './testing/factories';

const valid = { email: ' Ana@X.org ', name: 'Ana', message: 'Hola', accepted: true };

describe('shared/domain/enrollment', () => {
  it('RF-4 (001): una solicitud válida se normaliza', () => {
    expect(PRIVACY_TEXT_VERSION).toMatch(/\S/);
    expect(validateEnrollmentRequest(valid)).toEqual({
      ok: true,
      value: { email: 'ana@x.org', name: 'Ana', message: 'Hola' },
    });
  });

  it('RF-4 (001): el mensaje admite 2.000 caracteres y no 2.001', () => {
    expect(validateEnrollmentRequest({ ...valid, message: 'a'.repeat(2000) }).ok).toBe(true);
    expect(validateEnrollmentRequest({ ...valid, message: 'a'.repeat(2001) })).toEqual({
      ok: false,
      code: 'message-too-long',
    });
    expect(validateEnrollmentRequest({ ...valid, message: '😀'.repeat(2000) }).ok).toBe(true);
  });

  it('RF-4 (001): sin aceptar el tratamiento de datos no se envía', () => {
    expect(validateEnrollmentRequest({ ...valid, accepted: false })).toEqual({
      ok: false,
      code: 'consent-required',
    });
  });

  it('RF-4 (001): el correo y el nombre deben ser válidos', () => {
    expect(validateEnrollmentRequest({ ...valid, email: 'sin-arroba' })).toEqual({ ok: false, code: 'email-invalid' });
    expect(validateEnrollmentRequest({ ...valid, email: '' })).toEqual({ ok: false, code: 'email-invalid' });
    expect(validateEnrollmentRequest({ ...valid, name: '  ' })).toEqual({ ok: false, code: 'name-invalid' });
  });

  it('RF-4 (001): las dos listas van de la más reciente a la más antigua', () => {
    const req = (id: string, status: EnrollmentDoc['status'], iso: string): EnrollmentDoc & { id: string } => ({
      id,
      status,
      createdAt: timestampFrom(new Date(iso)),
    });
    const { pending, resolved } = splitEnrollmentLists([
      req('a', 'pending', '2026-09-01T00:00:00Z'),
      req('b', 'accepted', '2026-09-02T00:00:00Z'),
      req('c', 'pending', '2026-09-03T00:00:00Z'),
      req('d', 'discarded', '2026-09-04T00:00:00Z'),
      req('e', 'accepted', '2026-08-01T00:00:00Z'),
    ]);
    expect(pending.map((r) => r.id)).toEqual(['c', 'a']);
    expect(resolved.map((r) => r.id)).toEqual(['d', 'b', 'e']);
  });

  it('RF-4 (001): descartar exige un motivo que no sea vacío ni solo espacios', () => {
    expect(validateDiscardReason('')).toEqual({ ok: false, code: 'reason-required' });
    expect(validateDiscardReason('  \n ')).toEqual({ ok: false, code: 'reason-required' });
    expect(validateDiscardReason('  Spam ')).toEqual({ ok: true, value: 'Spam' });
  });

  it('RF-8 (016) · 8.3: una solicitud caduca a los 30 días', () => {
    expect(ENROLLMENT_TTL_DAYS).toBe(30);
  });

  it('RF-8 (016) · 8.3: solo está caducada una pendiente con expiresAt pasado', () => {
    const now = new Date('2026-09-01T15:00:00Z');
    const base = { status: 'pending' as const, createdAt: timestampFrom(new Date('2026-07-01T00:00:00Z')) };
    expect(isEnrollmentExpired({ ...base, expiresAt: timestampFrom(new Date('2026-09-01T14:59:59Z')) }, now)).toBe(true);
    expect(isEnrollmentExpired({ ...base, expiresAt: timestampFrom(now) }, now)).toBe(true);
    expect(isEnrollmentExpired({ ...base, expiresAt: timestampFrom(new Date('2026-09-01T15:00:01Z')) }, now)).toBe(false);
    // Las solicitudes anteriores a la 016 no tienen expiresAt y no caducan.
    expect(isEnrollmentExpired(base, now)).toBe(false);
    // Una resuelta ya no tiene expiresAt; aunque lo conservara no cuenta como caducada.
    expect(
      isEnrollmentExpired({ status: 'accepted', createdAt: base.createdAt, expiresAt: timestampFrom(new Date('2026-08-01T00:00:00Z')) }, now),
    ).toBe(false);
  });

  it('RF-8 (016) · 8.3: la lista de pendientes oculta las caducadas y deja las resueltas', () => {
    const now = new Date('2026-09-01T15:00:00Z');
    const at = (iso: string) => timestampFrom(new Date(iso));
    const requests: Array<EnrollmentDoc & { id: string }> = [
      { id: 'vigente', status: 'pending', createdAt: at('2026-08-20T00:00:00Z'), expiresAt: at('2026-09-19T00:00:00Z') },
      { id: 'caducada', status: 'pending', createdAt: at('2026-07-01T00:00:00Z'), expiresAt: at('2026-07-31T00:00:00Z') },
      { id: 'antigua', status: 'pending', createdAt: at('2026-06-01T00:00:00Z') },
      { id: 'resuelta', status: 'discarded', createdAt: at('2026-07-01T00:00:00Z') },
    ];
    const lists = splitEnrollmentLists(requests, now);
    expect(lists.pending.map((r) => r.id)).toEqual(['vigente', 'antigua']);
    expect(lists.resolved.map((r) => r.id)).toEqual(['resuelta']);
  });
});
