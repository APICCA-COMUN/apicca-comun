// T-18 (021): el lienzo del mapa propio (RF-4 (021), RF-6 (021) · 6.3, RF-7 (021), RF-8 (021), RF-9 (021), D-T17 (021)).
// jsdom no mide: el lienzo usa su ventana de respaldo, de 960 × 560 px.
// T-13 (024) · RF-3 (024), D-T3 (024): el recorrido mueve el mapa (prop `focus`).
// T-14 (024) · RF-4 (024), D-T5 (024): abrir un camino encuadra sus ápices.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAP_LIMIT } from '../../shared/domain/discovery';
import type { Location } from '../../shared/domain/location';
import type { ListedApice } from '../data/apices';
import { blockNesting, expectBlocks } from '../testing/expectBlocks';
import { listed } from '../testing/listDoubles';
import { GameMap, type MapPath } from './GameMap';

const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
/** Zonas reales de resolución 7: el centro de Bogotá, Chapinero y Medellín. */
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const CHAPINERO = zone('8766e42d2ffffff', 4.649886, -74.060244);
const MEDELLIN = zone('876619d92ffffff', 6.243305, -75.585547);

const inZone = (count: number, location: Location, from = 1): ListedApice[] =>
  Array.from({ length: count }, (_, i) => listed(from + i, { location }));

const show = (items: readonly ListedApice[], props: Partial<Parameters<typeof GameMap>[0]> = {}) =>
  render(<GameMap items={items} selectedId={null} onSelect={() => {}} {...props} />);

const map = () => screen.getByRole('region', { name: 'Mapa de ápices' });
const level = () => map().getAttribute('data-level');
const world = () => map().querySelector<HTMLElement>('.game-map__world')!;
const buildings = () => [...map().querySelectorAll<HTMLButtonElement>('button.game-map__building')];
const named = (name: string) => screen.getByRole('button', { name });

describe('GameMap · mapa propio', () => {
  it('RF-4 (021) · 4.1, 4.2: se dibuja con formas propias, sin teselas, sin imágenes y sin nada que pida datos a otro sitio', () => {
    const { container } = show(inZone(3, CENTRO));
    expect(container.querySelector('.leaflet-container')).toBeNull();
    expect(container.querySelectorAll('img, image, iframe, link, script, [src], [href]')).toHaveLength(0);
    const ground = container.querySelector('svg.game-map__ground')!;
    expect(ground.getAttribute('aria-hidden')).toBe('true');
    expect(ground.querySelectorAll('.game-map__plate')).toHaveLength(1);
    for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(element.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|url\(/i);
    }
  });

  it('RF-4 (021) · 4.3: muestra el norte arriba y una escala de distancia', () => {
    show(inZone(3, CENTRO));
    expect(screen.getByRole('img', { name: 'Norte arriba' }).textContent).toContain('N');
    expect(map().querySelector('.game-map__scale')!.textContent).toBe('500 m');
    fireEvent.click(named('Alejar'));
    expect(map().querySelector('.game-map__scale')!.textContent).toBe('2 km');
  });

  it('RF-4 (021) · 4.4, RF-8 (021) · 8.5: cada edificio muestra el nombre de su ápice y se llama «nombre, Etapa»', () => {
    show([listed(1, { location: CENTRO, status: 'prototipo' }), listed(2, { location: CENTRO, name: 'Huerta del barrio' })]);
    expect(buildings().map((button) => button.getAttribute('aria-label'))).toEqual(['Ápice 1, Prototipo', 'Huerta del barrio, Idea']);
    expect(buildings().map((button) => button.querySelector('.game-map__name')!.textContent)).toEqual(['Ápice 1', 'Huerta del barrio']);
    expect(buildings().every((button) => button.querySelector('.building') !== null)).toBe(true);
  });

  it('RF-3 (003) · 3.1, 3.3, RF-6 (002) · 6.1: todo control del mapa es un bloque y ningún bloque va dentro de otro', () => {
    const { container } = show([...inZone(9, CENTRO), listed(20)]);
    expectBlocks(container);
    expect(blockNesting(container)).toEqual([]);
  });
});

describe('GameMap · manzanas', () => {
  it('RF-6 (021) · 6.1: los ápices de una zona van juntos, con un edificio cada uno, y el elegido lleva aria-pressed', () => {
    const onSelect = vi.fn();
    show(inZone(3, CENTRO), { selectedId: 'a2', onSelect });
    expect(buildings().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    fireEvent.click(named('Ápice 3, Idea'));
    expect(onSelect).toHaveBeenCalledWith('a3');
  });

  it('RF-6 (021) · 6.2, 6.3: con más de siete, siete edificios y un control con el número de los demás, que abre la lista de todos', () => {
    const onSelect = vi.fn();
    show(inZone(9, CENTRO), { onSelect });
    expect(buildings()).toHaveLength(7);
    const more = named('2 ápices más en esta manzana');
    expect(more.textContent).toBe('+2');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(more);
    const dialog = screen.getByRole('dialog', { name: 'Ápices de esta manzana' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(9);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ápice 9, Idea' }));
    expect(onSelect).toHaveBeenCalledWith('a9');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('GameMap · niveles', () => {
  it('RF-7 (021) · 7.1, RF-8 (021) · 8.2: tres niveles, con botones para acercar, alejar y volver al encuadre inicial', () => {
    show(inZone(3, CENTRO));
    expect(level()).toBe('0');
    expect(named('Acercar').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(named('Alejar'));
    expect(level()).toBe('1');
    expect(named('Acercar').getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(named('Alejar'));
    expect(level()).toBe('2');
    expect(named('Alejar').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(named('Alejar'));
    expect(level()).toBe('2');
    fireEvent.click(named('Ver todo'));
    expect(level()).toBe('0');
    for (const name of ['Acercar', 'Alejar', 'Ver todo']) expect(named(name).classList.contains('icon-button')).toBe(true);
  });

  it('RF-7 (021) · 7.2, 7.4: al abrir encuadra todos los ápices; alejado, los reúne en grupos con su número', () => {
    show([...inZone(2, CENTRO), ...inZone(1, CHAPINERO, 3), ...inZone(1, MEDELLIN, 4)]);
    expect(level()).toBe('2');
    expect(buildings()).toHaveLength(0);
    const groups = [...map().querySelectorAll<HTMLButtonElement>('button.game-map__group')];
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['1 ápice, acercar', '3 ápices, acercar']);
    expect(groups.map((group) => group.textContent)).toEqual(['1', '3']);
  });

  it('RF-7 (021) · 7.3: elegir un grupo acerca hasta sus manzanas y deja el foco en uno de sus edificios', () => {
    show([...inZone(2, CENTRO), ...inZone(1, MEDELLIN, 4)]);
    fireEvent.click(named('2 ápices, acercar'));
    expect(level()).toBe('0');
    expect(buildings().map((button) => button.getAttribute('aria-label'))).toContain('Ápice 1, Idea');
    expect(document.activeElement).toBe(named('Ápice 1, Idea'));
  });

  it('RF-7 (021) · 7.5: con más ápices que el tope lo avisa y ofrece la vista de lista', () => {
    const onList = vi.fn();
    show(Array.from({ length: MAP_LIMIT + 1 }, (_, i) => listed(i + 1)), { onList });
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain(`El mapa muestra ${MAP_LIMIT} de ${MAP_LIMIT + 1} ápices. Afina los filtros para ver el resto.`);
    expect(named(`${MAP_LIMIT} ápices sin ubicación, acercar`)).toBeTruthy();
    fireEvent.click(within(notice).getByRole('button', { name: 'Ver como lista' }));
    expect(onList).toHaveBeenCalled();
  });

  it('RF-7 (021) · 7.5: sin pasar el tope no hay aviso', () => {
    show(inZone(3, CENTRO));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('GameMap · moverse', () => {
  it('RF-8 (021) · 8.1: arrastrar mueve el mapa, y un arrastre no elige el edificio que queda debajo', () => {
    const onSelect = vi.fn();
    show(inZone(3, CENTRO), { onSelect });
    const before = world().style.transform;
    const target = named('Ápice 1, Idea');
    fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 260, clientY: 230 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 260, clientY: 230 });
    fireEvent.click(target);
    expect(world().style.transform).not.toBe(before);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(target);
    expect(onSelect).toHaveBeenCalledWith('a1');
  });

  it('RF-8 (021) · 8.3: con el foco en el mapa, las flechas lo mueven y + y - cambian el nivel', () => {
    show(inZone(3, CENTRO));
    expect(map().tabIndex).toBe(0);
    map().focus();
    const before = world().style.transform;
    fireEvent.keyDown(map(), { key: 'ArrowRight' });
    const moved = world().style.transform;
    expect(moved).not.toBe(before);
    fireEvent.keyDown(map(), { key: 'ArrowDown' });
    expect(world().style.transform).not.toBe(moved);
    fireEvent.keyDown(map(), { key: '-' });
    expect(level()).toBe('1');
    fireEvent.keyDown(map(), { key: '+' });
    expect(level()).toBe('0');
  });

  it('RF-8 (021) · 8.4, 8.5: un solo edificio está en el orden del tabulador y las flechas llevan el foco al más cercano en esa dirección', () => {
    show(inZone(3, CENTRO));
    // Tres en una manzana: a1 arriba, a2 abajo a la izquierda y a3 abajo a la derecha.
    expect(buildings().map((button) => button.tabIndex)).toEqual([0, -1, -1]);
    const first = named('Ápice 1, Idea');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Ápice [23], Idea$/);
    named('Ápice 2, Idea').focus();
    fireEvent.keyDown(named('Ápice 2, Idea'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(named('Ápice 3, Idea'));
    expect(buildings().map((button) => button.tabIndex)).toEqual([-1, -1, 0]);
    fireEvent.keyDown(named('Ápice 3, Idea'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('RF-8 (021) · 8.6: la rueda sin tecla modificadora no cambia el nivel; con Ctrl o ⌘, sí', () => {
    show(inZone(3, CENTRO));
    fireEvent.wheel(map(), { deltaY: 120 });
    expect(level()).toBe('0');
    fireEvent.wheel(map(), { deltaY: 120, ctrlKey: true });
    expect(level()).toBe('1');
    fireEvent.wheel(map(), { deltaY: -120, metaKey: true });
    expect(level()).toBe('0');
  });
});

describe('GameMap · sin ubicación', () => {
  it('RF-9 (021) · 9.1, 9.2: los ápices sin ubicación van en un terreno aparte con su rótulo, y se eligen como los demás', () => {
    const onSelect = vi.fn();
    show([listed(1), listed(2, { location: null })], { onSelect });
    expect(level()).toBe('0');
    const terrain = screen.getByRole('group', { name: 'Sin ubicación' });
    expect(terrain.textContent).toContain('Sin ubicación');
    expect(within(terrain).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Ápice 1, Idea', 'Ápice 2, Idea']);
    expect(map().querySelectorAll('.game-map__terrain')).toHaveLength(1);
    fireEvent.click(within(terrain).getByRole('button', { name: 'Ápice 2, Idea' }));
    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('RF-9 (021) · 9.1: alejado, los ápices sin ubicación son un grupo aparte con su rótulo', () => {
    show([...inZone(3, CENTRO), listed(4), listed(5)]);
    expect(level()).toBe('1');
    expect(named('3 ápices, acercar')).toBeTruthy();
    const unlocated = named('2 ápices sin ubicación, acercar');
    fireEvent.click(unlocated);
    expect(level()).toBe('0');
    expect(document.activeElement).toBe(named('Ápice 4, Idea'));
  });
});

describe('GameMap · boceto', () => {
  it('RF-23 (021) · 23.2: el edificio del boceto lleva «Boceto» en su nombre y una marca de forma propia; los demás no', () => {
    const sketch = listed(9, { id: '__boceto__', name: 'Boceto', location: null });
    show([listed(1, { location: null }), sketch], { sketchId: '__boceto__' });
    const drawn = named('Boceto, Idea');
    expect(drawn.getAttribute('data-sketch')).toBe('true');
    expect(named('Ápice 1, Idea').hasAttribute('data-sketch')).toBe(false);
  });
});

describe('GameMap · caminos', () => {
  const path = (extra: Partial<MapPath> = {}): MapPath => ({ id: 'c1', title: 'Agua lluvia', closed: false, apiceIds: ['a1', 'a2', 'a3'], ...extra });
  const lines = () => [...map().querySelectorAll<SVGPolylineElement>('polyline.game-map__path')];

  it('RF-18 (021) · 18.1, 18.2, 18.4, D-T30 (021): cada camino se dibuja bajo los edificios, pasa por sus ápices y se nombra con su título', () => {
    const onSelectPath = vi.fn();
    show(inZone(3, CENTRO), { paths: [path()], onSelectPath });
    expect(lines()).toHaveLength(1);
    expect(lines()[0]!.getAttribute('points')!.split(' ')).toHaveLength(3);
    expect(lines()[0]!.closest('svg')!.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(named('Camino: Agua lluvia'));
    expect(onSelectPath).toHaveBeenCalledWith('c1');
  });

  it('RF-18 (021) · 18.6: el camino cerrado se distingue por su forma y por el texto «Cerrado»', () => {
    show([...inZone(2, CENTRO), listed(3, { location: CHAPINERO })], { paths: [path({ closed: true })] });
    expect(lines()[0]!.getAttribute('data-closed')).toBe('true');
    expect(named('Camino: Agua lluvia · Cerrado').textContent).toBe('Agua lluvia · Cerrado');
  });

  it('RF-18 (021) · 18.7: con menos de dos ápices a la vista, el camino no se dibuja', () => {
    show(inZone(1, CENTRO), { paths: [path()] });
    expect(lines()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Camino:/ })).toBeNull();
  });

  it('RF-18 (021) · 18.8, RF-8 (021) · 8.4: el rótulo entra en el foco itinerante y se alcanza con las flechas', () => {
    show(inZone(3, CENTRO), { paths: [path()] });
    const label = named('Camino: Agua lluvia');
    expect(label.tabIndex).toBe(-1);
    const all = [...map().querySelectorAll<HTMLButtonElement>('button.game-map__building, button.game-map__path-label')];
    expect(all.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(buildings().length).toBe(3);
  });

  it('D-T31 (021): el camino en borrador se dibuja aparte, sin rótulo, y el elegido se marca', () => {
    show([...inZone(2, CENTRO), listed(3, { location: CHAPINERO })], { paths: [path({ id: 'draft', draft: true })], selectedPathId: null });
    expect(lines()[0]!.getAttribute('data-draft')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Camino:/ })).toBeNull();
  });

  it('RF-20 (021) · 20.1: el camino elegido se marca con aria-pressed', () => {
    show([...inZone(2, CENTRO), listed(3, { location: CHAPINERO })], { paths: [path()], selectedPathId: 'c1' });
    expect(named('Camino: Agua lluvia').getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-20 (021) · 20.4, D-T32 (021): elegir desde fuera del mapa un ápice que no está a la vista lo lleva a su edificio', () => {
    const items = [...inZone(2, CENTRO), listed(3, { location: MEDELLIN })];
    const { rerender } = show(items);
    expect(level()).toBe('2');
    expect(map().querySelector('button.game-map__building')).toBeNull();
    rerender(<GameMap items={items} selectedId="a3" onSelect={() => {}} />);
    expect(level()).toBe('0');
    expect(named('Ápice 3, Idea').getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-20 (021) · 20.4: elegir un edificio que ya está a la vista no mueve el mapa', () => {
    const items = inZone(3, CENTRO);
    const { rerender } = show(items);
    const before = world().style.transform;
    rerender(<GameMap items={items} selectedId="a2" onSelect={() => {}} />);
    expect(world().style.transform).toBe(before);
  });
});

describe('GameMap · el recorrido lo mueve (RF-3 (024))', () => {
  const items = [...inZone(2, CENTRO), listed(3, { location: MEDELLIN })];
  const withFocus = (focus: { token: number; ids: readonly string[] } | null) => (
    <GameMap items={items} selectedId={null} onSelect={() => {}} focus={focus} />
  );
  /** El edificio cae dentro de la ventana de respaldo (960 × 560): la traslación del mundo lo deja a la vista. */
  const inView = (name: string): boolean => {
    const [, tx, ty] = /translate\((-?\d+)px, (-?\d+)px\)/.exec(world().style.transform)!.map(Number) as [number, number, number];
    const button = named(name);
    const x = parseFloat(button.style.left) + tx;
    const y = parseFloat(button.style.top) + ty;
    return x >= 0 && y >= 0 && x + 92 <= 960 && y + 108 <= 560; // el edificio mide 92 × 108
  };

  it('RF-3 (024) · 3.1: un «focus» nuevo acerca al nivel cercano con el ápice a la vista', () => {
    const { rerender } = render(withFocus(null));
    expect(level()).toBe('2');
    rerender(withFocus({ token: 1, ids: ['a1'] }));
    expect(level()).toBe('0');
    expect(inView('Ápice 1, Idea')).toBe(true);
  });

  it('RF-3 (024) · 3.2: con los ápices de un camino cercano, los deja a la vista a la vez', () => {
    const { rerender } = render(withFocus(null));
    rerender(withFocus({ token: 1, ids: ['a1', 'a2'] }));
    expect(level()).toBe('0');
    expect(inView('Ápice 1, Idea')).toBe(true);
    expect(inView('Ápice 2, Idea')).toBe(true);
  });

  it('RF-3 (024): el mismo token no repite el movimiento: si la persona movió el mapa, se queda donde lo dejó', () => {
    const { rerender } = render(withFocus({ token: 1, ids: ['a1'] }));
    expect(level()).toBe('0');
    fireEvent.click(named('Alejar'));
    expect(level()).toBe('1');
    rerender(withFocus({ token: 1, ids: ['a1'] }));
    expect(level()).toBe('1');
    rerender(withFocus({ token: 2, ids: ['a1'] }));
    expect(level()).toBe('0');
  });

  it('RF-3 (024): «Ver todo» deshace el movimiento y vuelve al encuadre inicial', () => {
    const { rerender } = render(withFocus(null));
    rerender(withFocus({ token: 1, ids: ['a1'] }));
    expect(level()).toBe('0');
    fireEvent.click(named('Ver todo'));
    expect(level()).toBe('2');
  });

  it('RF-3 (024): sin «focus» (o con ids que no están) el mapa no se mueve', () => {
    const { rerender } = render(withFocus(null));
    const before = world().style.transform;
    rerender(withFocus({ token: 1, ids: [] }));
    expect(world().style.transform).toBe(before);
    expect(level()).toBe('2');
  });
});

describe('GameMap · el recorrido reserva el área de la tarjeta (D-12 (024))', () => {
  const items = [...inZone(2, CENTRO), listed(3, { location: MEDELLIN })];
  const withFocus = (focus: { token: number; ids: readonly string[]; reserve?: () => number } | null) => (
    <GameMap items={items} selectedId={null} onSelect={() => {}} focus={focus} />
  );
  const offsetY = (): number => Number(/translate\((-?\d+)px, (-?\d+)px\)/.exec(world().style.transform)![2]);

  it('RF-3 (024) · D-12 (024): con `reserve` el ápice queda más arriba, por la mitad de lo reservado', () => {
    const plain = render(withFocus({ token: 1, ids: ['a1'] }));
    const free = offsetY();
    plain.unmount();
    render(withFocus({ token: 1, ids: ['a1'], reserve: () => 200 }));
    expect(offsetY()).toBe(free - 100);
  });

  it('RF-3 (024) · D-12 (024): sin reservar (la tarjeta se quitó) el siguiente movimiento vuelve al encuadre de siempre', () => {
    const plain = render(withFocus({ token: 1, ids: ['a1'] }));
    const free = offsetY();
    plain.unmount();
    const { rerender } = render(withFocus({ token: 1, ids: ['a1'], reserve: () => 200 }));
    expect(offsetY()).toBe(free - 100);
    rerender(withFocus({ token: 2, ids: ['a1'], reserve: () => 0 }));
    expect(offsetY()).toBe(free);
    rerender(withFocus({ token: 3, ids: ['a1'] }));
    expect(offsetY()).toBe(free);
  });

  it('RF-3 (024) · D-12 (024): la reserva se mide al mover, no antes, y un mismo token no la repite', () => {
    let reserved = 0;
    const reserve = vi.fn(() => reserved);
    const { rerender } = render(withFocus(null));
    expect(reserve).not.toHaveBeenCalled();
    reserved = 120;
    rerender(withFocus({ token: 1, ids: ['a1'], reserve }));
    expect(reserve).toHaveBeenCalledTimes(1);
    rerender(withFocus({ token: 1, ids: ['a1'], reserve }));
    expect(reserve).toHaveBeenCalledTimes(1);
  });
});

describe('GameMap · abrir un camino lo encuadra (RF-4 (024))', () => {
  const items = [...inZone(2, CENTRO), listed(3, { location: CHAPINERO }), listed(4, { location: MEDELLIN })];
  const road = (id: string, apiceIds: string[]): MapPath => ({ id, title: `Camino ${id}`, closed: false, apiceIds });
  const paths = [road('cerca', ['a1', 'a2']), road('lejos', ['a1', 'a3']), road('solo', ['a1', 'desconocido']), road('nada', ['x', 'y'])];
  const open = (selectedPathId: string | null, selectedId: string | null = null) => (
    <GameMap items={items} paths={paths} selectedPathId={selectedPathId} selectedId={selectedId} onSelect={() => {}} />
  );
  const line = (id: string) => screen.queryByRole('button', { name: `Camino: Camino ${id}` });

  it('RF-4 (024) · 4.1: al elegir un camino cercano, el mapa pasa al nivel cercano con sus ápices a la vez a la vista', () => {
    const { rerender } = render(open(null));
    expect(level()).toBe('2');
    rerender(open('cerca'));
    expect(level()).toBe('0');
    expect(named('Ápice 1, Idea')).toBeTruthy();
    expect(named('Ápice 2, Idea')).toBeTruthy();
    expect(line('cerca')).toBeTruthy();
  });

  it('RF-4 (024): con ápices en zonas lejanas, el nivel es el más cercano en que caben y el camino se dibuja', () => {
    const { rerender } = render(open(null));
    rerender(open('lejos'));
    expect(Number(level())).toBeGreaterThan(0);
    expect(line('lejos')).toBeTruthy();
  });

  it('RF-4 (024): con un solo ápice a la vista, encuadra ese', () => {
    const { rerender } = render(open(null));
    rerender(open('solo'));
    expect(level()).toBe('0');
    expect(named('Ápice 1, Idea')).toBeTruthy();
  });

  it('RF-4 (024), RF-18 (021) · 18.7: con ninguno a la vista, el mapa queda en el encuadre inicial', () => {
    const { rerender } = render(open(null));
    const before = world().style.transform;
    rerender(open('nada'));
    expect(level()).toBe('2');
    expect(world().style.transform).toBe(before);
  });

  it('RF-4 (024): no se repite mientras el camino siga elegido, y un camino nuevo sí encuadra', () => {
    const { rerender } = render(open('cerca'));
    expect(level()).toBe('0');
    fireEvent.click(named('Alejar'));
    expect(level()).toBe('1');
    rerender(open('cerca'));
    expect(level()).toBe('1');
    rerender(open(null));
    rerender(open('cerca'));
    expect(level()).toBe('0');
  });

  it('RF-4 (024), RF-20 (021) · 20.4: el ápice elegido desde el panel manda sobre el camino', () => {
    const { rerender } = render(open(null));
    rerender(open('lejos', 'a4'));
    expect(named('Ápice 4, Idea').getAttribute('aria-pressed')).toBe('true');
    expect(level()).toBe('0');
    const withRoad = world().style.transform;
    cleanup();
    const { rerender: again } = render(open(null));
    again(open(null, 'a4'));
    expect(world().style.transform).toBe(withRoad); // el mismo encuadre que sin camino
  });

  it('RF-4 (024) · 4.1: «Ver todo» deshace el encuadre del camino', () => {
    const { rerender } = render(open(null));
    rerender(open('cerca'));
    fireEvent.click(named('Ver todo'));
    expect(level()).toBe('2');
  });
});
