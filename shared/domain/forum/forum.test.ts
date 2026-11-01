import { describe, expect, it } from 'vitest';
import { AXES } from '../apice';
import { FORUM_LIMITS, axisFilterLabel, filterByAxis, repliesLabel, sortByActivity, validateMessage, validateThreadTitle, type ThreadSummary } from './forum';

const thread = (id: string, axis: ThreadSummary['axis'], lastMessageAt: number): ThreadSummary => ({
  id,
  title: `Hilo ${id}`,
  axis,
  authorUsername: 'lucia',
  lastMessageAt,
  messageCount: 1,
});

describe('forum · foro', () => {
  it('RF-3 (009) · 3.1: el título admite de 3 a 120 caracteres', () => {
    expect(FORUM_LIMITS.titleMin).toBe(3);
    expect(FORUM_LIMITS.title).toBe(120);
    expect(validateThreadTitle('ab').ok).toBe(false);
    expect(validateThreadTitle('abc').ok).toBe(true);
    expect(validateThreadTitle('a'.repeat(120)).ok).toBe(true);
    const long = validateThreadTitle('a'.repeat(121));
    expect(long.ok).toBe(false);
    expect(long.reason).toContain('120');
  });

  it('RF-3 (009) · 3.1: el mensaje admite de 1 a 2000 caracteres y no puede ser solo espacios', () => {
    expect(FORUM_LIMITS.message).toBe(2000);
    expect(validateMessage('').ok).toBe(false);
    expect(validateMessage('   \n ').ok).toBe(false);
    expect(validateMessage('Hola').ok).toBe(true);
    const long = validateMessage('a'.repeat(2001));
    expect(long.ok).toBe(false);
    expect(long.reason).toContain('2000');
  });

  it('RF-3 (009) · 3.3: el tope es de 10 hilos por 24 horas y la tanda es de 20', () => {
    expect(FORUM_LIMITS.threadsPerDay).toBe(10);
    expect(FORUM_LIMITS.pageSize).toBe(20);
  });

  it('RF-1 (009): la lista va del hilo con actividad más reciente al más antiguo', () => {
    const sorted = sortByActivity([thread('a', 'agua', 10), thread('b', 'agua', 30), thread('c', 'agua', 20)]);
    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('RF-2 (009): el filtro deja solo los hilos del eje y sin filtro deja todos', () => {
    const list = [thread('a', 'agua', 1), thread('b', 'cobijo', 2), thread('c', 'agua', 3)];
    expect(filterByAxis(list, 'agua').map((t) => t.id)).toEqual(['a', 'c']);
    expect(filterByAxis(list, null)).toHaveLength(3);
  });

  it('RF-2 (009) · 2.1: cada filtro se llama «Eje <nombre>»', () => {
    expect(AXES.map(axisFilterLabel)).toEqual(['Eje Agua', 'Eje Alimento', 'Eje Cobijo', 'Eje Energía', 'Eje Comunicación']);
  });

  it('RF-1 (009): el número de respuestas se dice con su plural', () => {
    expect(repliesLabel(0)).toBe('0 respuestas');
    expect(repliesLabel(1)).toBe('1 respuesta');
    expect(repliesLabel(7)).toBe('7 respuestas');
  });

  it('RNF-1 (009): ordenar y filtrar no cambian la lista de entrada', () => {
    const list = [thread('a', 'agua', 1), thread('b', 'cobijo', 2)];
    const copy = [...list];
    sortByActivity(list);
    filterByAxis(list, 'agua');
    expect(list).toEqual(copy);
  });
});
