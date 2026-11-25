// «E3 · Celda»: la capa de los Arcos. Cada tramo va dos veces (halo de papel y trazo de tinta) y cada parada lleva un disco.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { arcHalo, arcStroke, buildArc } from '../../shared/domain/mapArcs';
import { ArcLayer, type ArcItem } from './ArcLayer';

const R = 46;
const arc = buildArc(
  [
    { x: 0, y: 0 },
    { x: 200, y: 40 },
    { x: 380, y: -30 },
  ],
  R,
  { apices: [] },
)!;
const item = (extra: Partial<ArcItem> = {}): ArcItem => ({ id: 'c1', arc, closed: false, draft: false, selected: false, off: false, ...extra });
const layer = (items: ArcItem[]) => render(<ArcLayer arcs={items} />).container.querySelector('svg')!;

describe('ArcLayer', () => {
  it('es una capa decorativa, sin texto, y no lleva colores literales', () => {
    const svg = layer([item()]);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.textContent).toBe('');
    expect(svg.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|url\(/i);
  });

  it('dibuja cada tramo dos veces y un disco con su halo por parada', () => {
    const group = layer([item()]).querySelector('g.game-map__arc')!;
    expect(group.getAttribute('data-arc')).toBe('c1');
    expect(group.querySelectorAll('.game-map__arc-halo')).toHaveLength(arc.segments.length);
    expect(group.querySelectorAll('.game-map__arc-line')).toHaveLength(arc.segments.length);
    expect(group.querySelectorAll('.game-map__arc-disc')).toHaveLength(arc.discs.length);
    expect(group.querySelectorAll('.game-map__arc-disc-halo')).toHaveLength(arc.discs.length);
    expect(Number(group.querySelector('.game-map__arc-line')!.getAttribute('stroke-width'))).toBeCloseTo(arcStroke(R), 5);
    expect(Number(group.querySelector('.game-map__arc-halo')!.getAttribute('stroke-width'))).toBeCloseTo(arcHalo(R), 5);
    const first = arc.discs[0]!;
    expect(Number(group.querySelector('.game-map__arc-disc')!.getAttribute('r'))).toBeCloseTo(first.r, 5);
  });

  it('marca cerrada, borrador, elegida y apagada, y la elegida es 1,6 veces más gruesa', () => {
    const svg = layer([item({ id: 'a', closed: true }), item({ id: 'b', draft: true }), item({ id: 'c', selected: true }), item({ id: 'd', off: true })]);
    const get = (id: string) => svg.querySelector(`g[data-arc="${id}"]`)!;
    expect(get('a').getAttribute('data-closed')).toBe('true');
    expect(get('b').getAttribute('data-draft')).toBe('true');
    expect(get('c').getAttribute('data-selected')).toBe('true');
    expect(get('d').getAttribute('data-off')).toBe('true');
    expect(get('a').getAttribute('data-off')).toBeNull();
    const width = (id: string) => Number(get(id).querySelector('.game-map__arc-line')!.getAttribute('stroke-width'));
    expect(width('c')).toBeCloseTo(width('a') * 1.6, 5);
  });

  it('dibuja primero lo apagado y al final lo elegido', () => {
    const svg = layer([item({ id: 'sel', selected: true }), item({ id: 'vivo' }), item({ id: 'off', off: true })]);
    expect([...svg.querySelectorAll('g.game-map__arc')].map((element) => element.getAttribute('data-arc'))).toEqual(['off', 'vivo', 'sel']);
  });
});
