import { describe, expect, it } from 'vitest';
import { NOTICE_LIMIT, NOTICE_RETENTION_DAYS, bellLabel, countLabel, mergeNotices, noticeText, unreadCount, visibleNotices, type Notice } from './notices';

const DAY = 24 * 3600 * 1000;
const now = Date.UTC(2026, 9, 10, 12);
const notice = (id: string, at: number, over: Partial<Notice> = {}): Notice => ({
  id,
  type: 'apice-editado',
  at,
  href: '/apices/a1',
  actor: 'beto',
  subject: 'Huerta',
  ...over,
});

describe('notices · avisos', () => {
  it('RF-4 (012) · 4.2: los avisos van del más reciente al más antiguo, sin repetir ids', () => {
    const merged = mergeNotices([notice('a', 10), notice('b', 30)], [notice('c', 20), notice('a', 10)]);
    expect(merged.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('RF-4 (012) · 4.3: se muestran como máximo 20 avisos', () => {
    expect(NOTICE_LIMIT).toBe(20);
    const many = Array.from({ length: 25 }, (_, i) => notice(`n${i}`, now - i));
    expect(visibleNotices(many, now)).toHaveLength(20);
    expect(visibleNotices(many, now)[0]?.id).toBe('n0');
  });

  it('RNF-4 (012): solo se muestran los avisos de los últimos 90 días', () => {
    expect(NOTICE_RETENTION_DAYS).toBe(90);
    const list = [notice('nuevo', now - 89 * DAY), notice('justo', now - 90 * DAY), notice('viejo', now - 90 * DAY - 1)];
    expect(visibleNotices(list, now).map((n) => n.id)).toEqual(['nuevo', 'justo']);
  });

  it('RF-3 (012): sin leer es todo aviso posterior a la marca; sin marca, todos', () => {
    const list = [notice('a', 100), notice('b', 200), notice('c', 300)];
    expect(unreadCount(list, 200)).toBe(1);
    expect(unreadCount(list, null)).toBe(3);
    expect(unreadCount(list, 300)).toBe(0);
  });

  it('RF-4 (012) · 4.4: el contador pasa de 99 a «99+» y con cero no se muestra', () => {
    expect(countLabel(0)).toBe('');
    expect(countLabel(7)).toBe('7');
    expect(countLabel(99)).toBe('99');
    expect(countLabel(100)).toBe('99+');
  });

  it('RF-4 (012) · 4.1: el nombre accesible de la campana dice cuántos hay sin leer', () => {
    expect(bellLabel(3)).toBe('Avisos: tienes 3 sin leer');
    expect(bellLabel(1)).toBe('Avisos: tienes 1 sin leer');
    expect(bellLabel(0)).toBe('Avisos: no tienes avisos sin leer');
    expect(bellLabel(150)).toBe('Avisos: tienes 99+ sin leer');
  });

  it('RF-1 (012) y RF-2 (012): cada tipo tiene su texto', () => {
    expect(noticeText(notice('a', 1))).toBe('@beto editó «Huerta»');
    expect(noticeText(notice('a', 1, { type: 'apice-archivado' }))).toBe('@beto archivó «Huerta»');
    expect(noticeText(notice('a', 1, { type: 'constitucion-abierta', actor: 'ana', subject: 'Agua' }))).toBe(
      'Propuesta de cambio abierta por @ana: «Agua»',
    );
    expect(noticeText(notice('a', 1, { type: 'constitucion-resuelta', actor: 'ana', subject: 'Agua' }))).toBe(
      'Se resolvió la propuesta de @ana: «Agua»',
    );
  });

  it('RNF-1 (012): la unión no cambia las listas de entrada', () => {
    const a = [notice('a', 10)];
    const b = [notice('b', 20)];
    mergeNotices(a, b);
    expect(a.map((n) => n.id)).toEqual(['a']);
    expect(b.map((n) => n.id)).toEqual(['b']);
  });
});
