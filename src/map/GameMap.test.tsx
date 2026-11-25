// T-18 (021): el lienzo del mapa propio (RF-4 (021), RF-6 (021) · 6.3, RF-7 (021), RF-8 (021), RF-9 (021), D-T17 (021)),
// ahora un teselado H3 con las superficies del sistema «APICCA · Mapa» y las Acciones Comunes como Arcos («E3 · Celda»).
// jsdom no mide: el lienzo usa su ventana de respaldo, de 960 × 560 px.
// T-13 (024) · RF-3 (024), D-T3 (024): el recorrido mueve el mapa (prop `focus`).
// T-14 (024) · RF-4 (024), D-T5 (024): abrir una Acción Común encuadra sus Ápices.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAP_LIMIT } from '../../shared/domain/discovery';
import type { Location } from '../../shared/domain/location';
import type { ListedApice } from '../data/apices';
import { blockNesting, expectBlocks } from '../testing/expectBlocks';
import { listed } from '../testing/listDoubles';
import { layoutMap, type MapApice, type MapSpot } from '../../shared/domain/hexmap';
import { rectsOverlap } from '../../shared/domain/mapPaths';
import { GameMap, labelAreas, planLabels, type MapPath } from './GameMap';

const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
/** Zonas reales de resolución 7: el centro de Bogotá, Chapinero y Medellín. */
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const CHAPINERO = zone('8766e42d2ffffff', 4.649886, -74.060244);
/** A unos 2,5 km del centro: sus zonas caben a la vez en el nivel cercano y la ruta entre ellas lleva celdas. */
const VECINA = zone('8766e0905ffffff', 4.61069, -74.103401);
const MEDELLIN = zone('876619d92ffffff', 6.243305, -75.585547);

const inZone = (count: number, location: Location, from = 1): ListedApice[] =>
  Array.from({ length: count }, (_, i) => listed(from + i, { location }));

const show = (items: readonly ListedApice[], props: Partial<Parameters<typeof GameMap>[0]> = {}) =>
  render(<GameMap items={items} selectedId={null} onSelect={() => {}} {...props} />);

const map = () => screen.getByRole('region', { name: 'Mapa de ápices' });
const level = () => map().getAttribute('data-level');
const world = () => map().querySelector<HTMLElement>('.game-map__world')!;
const cells = () => [...map().querySelectorAll<HTMLButtonElement>('button.game-map__apice')];
const named = (name: string) => screen.getByRole('button', { name });
const leftOf = (button: HTMLElement) => parseFloat(button.style.left);
const topOf = (button: HTMLElement) => parseFloat(button.style.top);

describe('GameMap · mapa propio', () => {
  it('RF-4 (021) · 4.1, 4.2: se dibuja con formas propias, sin teselas, sin imágenes y sin nada que pida datos a otro sitio', () => {
    const { container } = show(inZone(3, CENTRO));
    expect(container.querySelector('.leaflet-container')).toBeNull();
    expect(container.querySelectorAll('img, image, iframe, link, script, [src], [href]')).toHaveLength(0);
    const ground = container.querySelector('svg.game-map__ground')!;
    expect(ground.getAttribute('aria-hidden')).toBe('true');
    for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(element.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|url\(/i);
    }
  });

  it('RF-4 (021) · 4.1: la trama solo cubre las zonas, y cada zona lleva su borde y su rótulo', () => {
    const { container } = show(inZone(3, CENTRO));
    const ground = container.querySelector('svg.game-map__ground')!;
    expect(ground.querySelector('path.game-map__tessellation')!.getAttribute('d')!.length).toBeGreaterThan(100);
    // La trama solo existe en el nivel cercano y bajo las zonas: en los demás niveles no hay.
    const trama = ground.querySelector('path.game-map__tessellation')!;
    expect(trama.getAttribute('d')).toMatch(/^M/);
    fireEvent.click(named('Alejar'));
    expect(container.querySelector('path.game-map__tessellation')?.getAttribute('d') ?? '').toBe('');
    fireEvent.click(named('Alejar'));
    expect(container.querySelector('path.game-map__tessellation')?.getAttribute('d') ?? '').toBe('');
    fireEvent.click(named('Acercar'));
    fireEvent.click(named('Acercar'));
    // El borde de zona va en su propia capa, encima de las celdas.
    const outlines = container.querySelector('svg.game-map__outlines')!;
    expect(outlines.querySelectorAll('.game-map__zone-outline')).toHaveLength(1);
    const outline = outlines.querySelector('.game-map__zone-outline')!.getAttribute('points')!.trim().split(' ');
    expect(outline).toHaveLength(18);
    const group = screen.getByRole('group', { name: /^Zona [0-9A-F]{4}$/i });
    expect(group.querySelector('.game-map__label--zone')!.textContent).toMatch(/^Zona [0-9a-f]{4} · \d+ Ápices?$/);
  });

  it('RF-4 (021) · 4.3: muestra el norte arriba y una escala de distancia', () => {
    show(inZone(3, CENTRO));
    expect(screen.getByRole('img', { name: 'Norte arriba' }).textContent).toContain('N');
    expect(map().querySelector('.game-map__scale')!.textContent).toBe('1 km');
    fireEvent.click(named('Alejar'));
    expect(map().querySelector('.game-map__scale')!.textContent).toBe('5 km');
    fireEvent.click(named('Alejar'));
    expect(map().querySelector('.game-map__scale')!.textContent).toBe('50 km');
  });

  it('RF-4 (021) · 4.4, RF-8 (021) · 8.5: cada celda se llama «nombre, eje, Etapa» y lleva su nombre fuera del patrón', () => {
    show([
      listed(1, { location: CENTRO, status: 'prototipo' }),
      listed(2, { location: CENTRO, name: 'Huerta del barrio', axes: ['alimento', 'agua'] }),
    ]);
    expect(cells().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Ápice 1, agua, Prototipo',
      'Huerta del barrio, alimento y agua, Idea',
    ]);
    expect(cells().map((button) => button.querySelector('.game-map__tag')!.textContent)).toEqual(['Ápice 1', 'Huerta del barrio']);
    for (const button of cells()) {
      // El nombre no va dentro del dibujo: el patrón queda limpio (RF-4 (021) · 4.4).
      expect(button.querySelector('svg')!.querySelector('text')).toBeNull();
      expect(button.querySelector('svg .game-map__hex')).not.toBeNull();
    }
  });

  it('cada celda lleva su superficie de patrón: un Ápice de varios ejes va en franjas verticales, una por eje', () => {
    show([
      listed(1, { location: CENTRO, axes: ['agua'] }),
      listed(2, { location: CENTRO, axes: ['alimento', 'energía'], status: 'en marcha' }),
    ]);
    const one = cells()[0]!;
    const two = cells()[1]!;
    expect(one.querySelectorAll('.superficie__franja')).toHaveLength(1);
    expect(one.querySelector('.superficie--agua')).not.toBeNull();
    expect(two.querySelectorAll('.superficie__franja')).toHaveLength(2);
    expect(two.querySelector('.superficie--alimento')).not.toBeNull();
    expect(two.querySelector('.superficie--energia')).not.toBeNull();
    // La Etapa va en la regla del patrón (idea, prototipo y en marcha se distinguen sin el color).
    expect(one.querySelector('[data-rule]')!.getAttribute('data-rule')).not.toBe(
      two.querySelector('[data-rule]')!.getAttribute('data-rule'),
    );
  });

  it('el Ápice elegido ya no lleva el doble anillo de P1: su estado es aria-pressed (contorno de 4 px en la hoja de estilos)', () => {
    show(inZone(3, CENTRO), { selectedId: 'a2' });
    const [one, two] = [named('Ápice 1, agua, Idea'), named('Ápice 2, agua, Idea')];
    expect(two.querySelectorAll('.game-map__ring')).toHaveLength(0);
    expect(one.querySelectorAll('.game-map__ring')).toHaveLength(0);
    expect(two.getAttribute('aria-pressed')).toBe('true');
    expect(one.getAttribute('aria-pressed')).toBe('false');
  });

  it('RF-3 (003) · 3.1, 3.3, RF-6 (002) · 6.1: todo control del mapa es un bloque y ningún bloque va dentro de otro', () => {
    const { container } = show([...inZone(9, CENTRO), listed(20)]);
    expectBlocks(container);
    expect(blockNesting(container)).toEqual([]);
  });

  it('el vocabulario visible y accesible del mapa no usa los términos del juego anterior', () => {
    const { container } = show([...inZone(9, CENTRO), listed(20)], {
      paths: [{ id: 'c1', title: 'Agua lluvia', closed: false, apiceIds: ['a1', 'a2'] }],
    });
    const texts = [
      container.textContent ?? '',
      ...[...container.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label') ?? ''),
    ];
    for (const text of texts) expect(text).not.toMatch(/jugar|juego|edificio|manzana|camino|constru|plaza|puntos|puntaje|monedas|precio/i);
  });
});

describe('GameMap · zonas', () => {
  it('RF-6 (021) · 6.1: los Ápices de una zona van juntos, una celda cada uno, y el elegido lleva aria-pressed', () => {
    const onSelect = vi.fn();
    show(inZone(3, CENTRO), { selectedId: 'a2', onSelect });
    expect(cells().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    fireEvent.click(named('Ápice 3, agua, Idea'));
    expect(onSelect).toHaveBeenCalledWith('a3');
  });

  it('RF-6 (021) · 6.2, 6.3: con más de los que caben, seis celdas y una de tinta con el número de los demás, que abre la lista de todos', () => {
    const onSelect = vi.fn();
    show(inZone(9, CENTRO), { onSelect });
    expect(cells()).toHaveLength(6);
    const more = named('3 Ápices más en esta zona');
    expect(more.textContent).toBe('+3');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(more);
    const dialog = screen.getByRole('dialog', { name: 'Ápices de esta zona' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(9);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ápice 9, agua, Idea' }));
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

  it('RF-7 (021) · 7.2, 7.4: al abrir encuadra todos los Ápices; alejado, los reúne en grupos con su número', () => {
    show([...inZone(2, CENTRO), ...inZone(1, CHAPINERO, 3), ...inZone(1, MEDELLIN, 4)]);
    expect(level()).toBe('2');
    expect(cells()).toHaveLength(0);
    const groups = [...map().querySelectorAll<HTMLButtonElement>('button.game-map__group')];
    // Los grupos son celdas H3 de resolución 4: Medellín va aparte y las dos zonas de Bogotá quedan en una o en dos.
    const counts = groups.map((group) => Number(group.textContent)).sort();
    expect(counts.reduce((total, count) => total + count, 0)).toBe(4);
    expect(counts).toContain(1);
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(
      groups.map((group) => (group.textContent === '1' ? '1 Ápice, acercar' : `${group.textContent} Ápices, acercar`)),
    );
  });

  it('RF-7 (021) · 7.3: elegir un grupo acerca hasta sus zonas y deja el foco en una de sus celdas', () => {
    show([...inZone(2, CENTRO), ...inZone(1, MEDELLIN, 4)]);
    fireEvent.click(named('2 Ápices, acercar'));
    expect(level()).toBe('0');
    expect(cells().map((button) => button.getAttribute('aria-label'))).toContain('Ápice 1, agua, Idea');
    expect(['Ápice 1, agua, Idea', 'Ápice 2, agua, Idea']).toContain(document.activeElement?.getAttribute('aria-label'));
  });

  it('RF-7 (021) · 7.5: con más Ápices que el tope lo avisa y ofrece la vista de lista', () => {
    const onList = vi.fn();
    show(
      Array.from({ length: MAP_LIMIT + 1 }, (_, i) => listed(i + 1)),
      { onList },
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain(`El mapa muestra ${MAP_LIMIT} de ${MAP_LIMIT + 1} Ápices. Afina los filtros para ver el resto.`);
    expect(named(`${MAP_LIMIT} Ápices sin ubicación, acercar`)).toBeTruthy();
    fireEvent.click(within(notice).getByRole('button', { name: 'Ver como lista' }));
    expect(onList).toHaveBeenCalled();
  });

  it('RF-7 (021) · 7.5: sin pasar el tope no hay aviso', () => {
    show(inZone(3, CENTRO));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('GameMap · moverse', () => {
  it('RF-8 (021) · 8.1: arrastrar mueve el mapa, y un arrastre no elige la celda que queda debajo', () => {
    const onSelect = vi.fn();
    show(inZone(3, CENTRO), { onSelect });
    const before = world().style.transform;
    const target = named('Ápice 1, agua, Idea');
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

  it('RF-8 (021) · 8.4, 8.5: una sola celda está en el orden del tabulador y las flechas llevan el foco a la más cercana en esa dirección', () => {
    show(inZone(3, CENTRO));
    expect(
      cells()
        .map((button) => button.tabIndex)
        .filter((index) => index === 0),
    ).toHaveLength(1);
    expect(cells().filter((button) => button.tabIndex === 0)[0]).toBe(cells()[0]);
    // La más a la izquierda y la más a la derecha, según donde cayeron en la zona.
    const byX = [...cells()].sort((a, b) => leftOf(a) - leftOf(b));
    const west = byX[0]!;
    const east = byX[byX.length - 1]!;
    west.focus();
    fireEvent.keyDown(west, { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(west);
    expect(leftOf(document.activeElement as HTMLElement)).toBeGreaterThan(leftOf(west));
    expect(cells().filter((button) => button.tabIndex === 0)).toEqual([document.activeElement]);
    fireEvent.keyDown(east, { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(west);
    east.focus();
    fireEvent.keyDown(east, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(east); // sin nada a la derecha, el foco se queda
    fireEvent.keyDown(east, { key: 'ArrowLeft' });
    expect(leftOf(document.activeElement as HTMLElement)).toBeLessThan(leftOf(east));
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
  it('RF-9 (021) · 9.1, 9.2: los Ápices sin ubicación van en un terreno aparte con su rótulo, y se eligen como los demás', () => {
    const onSelect = vi.fn();
    show([listed(1), listed(2, { location: null })], { onSelect });
    expect(level()).toBe('0');
    const terrain = screen.getByRole('group', { name: 'Sin ubicación' });
    expect(map().querySelector('.game-map__label--terrain')!.textContent).toBe('Sin ubicación');
    expect(
      within(terrain)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Ápice 1, agua, Idea', 'Ápice 2, agua, Idea']);
    expect(map().querySelectorAll('.game-map__terrain')).toHaveLength(1);
    fireEvent.click(within(terrain).getByRole('button', { name: 'Ápice 2, agua, Idea' }));
    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('RF-9 (021) · 9.1: alejado, los Ápices sin ubicación son un grupo aparte con su rótulo', () => {
    show([...inZone(3, CENTRO), listed(4), listed(5)]);
    expect(level()).toBe('1');
    expect(named('3 Ápices, acercar')).toBeTruthy();
    const unlocated = named('2 Ápices sin ubicación, acercar');
    expect(map().querySelector('.game-map__label--below')!.textContent).toBe('Sin ubicación');
    fireEvent.click(unlocated);
    expect(level()).toBe('0');
    expect(['Ápice 4, agua, Idea', 'Ápice 5, agua, Idea']).toContain(document.activeElement?.getAttribute('aria-label'));
  });
});

describe('GameMap · boceto', () => {
  it('RF-23 (021) · 23.2: la celda del boceto lleva «Boceto» en su nombre y una marca de forma propia; las demás no', () => {
    const sketch = listed(9, { id: '__boceto__', name: 'Boceto', location: null });
    show([listed(1, { location: null }), sketch], { sketchId: '__boceto__' });
    const drawn = named('Boceto, agua, Idea');
    expect(drawn.getAttribute('data-sketch')).toBe('true');
    expect(drawn.querySelector('.game-map__ring--sketch')).not.toBeNull();
    expect(named('Ápice 1, agua, Idea').hasAttribute('data-sketch')).toBe(false);
  });
});

describe('GameMap · Acciones Comunes', () => {
  const path = (extra: Partial<MapPath> = {}): MapPath => ({
    id: 'c1',
    title: 'Agua lluvia',
    closed: false,
    apiceIds: ['a1', 'a2', 'a3'],
    ...extra,
  });
  /** Dos zonas vecinas: la ruta lleva celdas entre ellas. */
  const apart = () => [...inZone(2, CENTRO), listed(3, { location: VECINA })];
  /** El recorrido encuadra los tres Ápices en el nivel en que la ruta se dibuja. */
  const framed = { focus: { token: 1, ids: ['a1', 'a2', 'a3'] } };
  const arcs = () => [...map().querySelectorAll<SVGGElement>('g.game-map__arc')];
  const drawn = () => arcs().length;
  const lines = () => [...map().querySelectorAll<SVGPathElement>('.game-map__arc-line')];

  it('RF-18 (021) · 18.1, 18.2, 18.4, D-T30 (021): cada Acción Común es un Arco con un disco por Ápice, y su rótulo la abre y la nombra con su título', () => {
    const onSelectPath = vi.fn();
    show(apart(), { paths: [path({ axis: 'agua' })], onSelectPath, ...framed });
    expect(arcs()).toHaveLength(1);
    const layer = arcs()[0]!.closest('svg')!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    // Dos tramos para tres Ápices, cada uno dos veces (halo de papel y trazo de tinta); tres discos, cada uno con su halo.
    expect(arcs()[0]!.querySelectorAll('.game-map__arc-halo')).toHaveLength(2);
    expect(arcs()[0]!.querySelectorAll('.game-map__arc-line')).toHaveLength(2);
    expect(arcs()[0]!.querySelectorAll('.game-map__arc-disc')).toHaveLength(3);
    expect(arcs()[0]!.querySelectorAll('.game-map__arc-disc-halo')).toHaveLength(3);
    for (const line of lines()) expect(line.getAttribute('d')).toMatch(/^M-?[\d.]+ -?[\d.]+Q/);
    // El rótulo lleva el glifo del eje y el nombre; no hay celdas de ruta ni polilíneas.
    const label = named('Acción Común: Agua lluvia');
    expect(label.querySelector('.glifo')).not.toBeNull();
    expect(label.querySelector('.game-map__path-name')!.textContent).toBe('Agua lluvia');
    expect(map().querySelector('.game-map__route, .game-map__line')).toBeNull();
    fireEvent.click(label);
    expect(onSelectPath).toHaveBeenCalledWith('c1');
  });

  it('RF-9 (003) · 9.3, 9.4: la capa de los Arcos va oculta a los lectores de pantalla, no lleva texto y lo que acompaña está en el rótulo', () => {
    show(apart(), { paths: [path({ axis: 'agua' })], ...framed });
    expect(drawn()).toBeGreaterThan(0);
    const layer = arcs()[0]!.closest('svg')!;
    expect(layer.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(layer.textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Acción Común: Agua lluvia' })).toBeTruthy();
  });

  it('el Arco va sobre el borde de las zonas, bajo los rótulos y sin recibir el puntero', () => {
    const { container } = show(apart(), { paths: [path({ axis: 'agua' })], ...framed });
    const layers = [...container.querySelectorAll('.game-map__world > svg')];
    const outlines = container.querySelector('svg.game-map__outlines')!;
    const arcLayer = container.querySelector('svg.game-map__arcs')!;
    expect(layers.indexOf(arcLayer)).toBeGreaterThan(layers.indexOf(outlines));
    expect(arcLayer.getAttribute('focusable')).toBe('false');
  });

  it('RF-18 (021) · 18.2: dentro de una misma zona la Acción Común también se dibuja', () => {
    show(inZone(3, CENTRO), { paths: [path({ axis: 'agua' })] });
    expect(drawn()).toBe(1);
  });

  it('una Acción Común sin eje va sin glifo en su rótulo', () => {
    show(apart(), { paths: [path({ axis: null })], ...framed });
    expect(drawn()).toBe(1);
    expect(named('Acción Común: Agua lluvia').querySelector('.glifo')).toBeNull();
  });

  it('RF-18 (021) · 18.6: la Acción Común cerrada se distingue por su trazo y por el texto «Cerrada»', () => {
    show(apart(), { paths: [path({ closed: true, axis: 'agua' })], ...framed });
    expect(drawn()).toBe(1);
    expect(arcs()[0]!.getAttribute('data-closed')).toBe('true');
    expect(named('Acción Común: Agua lluvia · Cerrada').textContent).toBe('Agua lluvia · Cerrada');
  });

  it('RF-18 (021) · 18.7: con menos de dos Ápices a la vista, la Acción Común no se dibuja', () => {
    show(inZone(1, CENTRO), { paths: [path()] });
    expect(drawn()).toBe(0);
    expect(screen.queryByRole('button', { name: /^Acción Común:/ })).toBeNull();
  });

  it('RF-18 (021) · 18.8, RF-8 (021) · 8.4: el rótulo entra en el foco itinerante y se alcanza con las flechas', () => {
    show(apart(), { paths: [path()], ...framed });
    const label = named('Acción Común: Agua lluvia');
    expect(label.tabIndex).toBe(-1);
    const all = [...map().querySelectorAll<HTMLButtonElement>('button.game-map__apice, button.game-map__path-label')];
    expect(all.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(cells().length).toBe(3);
  });

  it('D-T31 (021): la Acción Común en borrador se dibuja aparte, sin rótulo', () => {
    show(apart(), { paths: [path({ id: 'draft', draft: true, axis: 'agua' })], selectedPathId: null, ...framed });
    expect(drawn()).toBe(1);
    expect(arcs()[0]!.getAttribute('data-draft')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Acción Común:/ })).toBeNull();
  });

  it('RF-20 (021) · 20.1: la Acción Común elegida se marca con aria-pressed y con el trazo grueso', () => {
    const { unmount } = show(apart(), { paths: [path({ axis: 'agua' })], selectedPathId: null, ...framed });
    const plain = Number(lines()[0]!.getAttribute('stroke-width'));
    unmount();
    show(apart(), { paths: [path({ axis: 'agua' })], selectedPathId: 'c1', ...framed });
    expect(named('Acción Común: Agua lluvia').getAttribute('aria-pressed')).toBe('true');
    expect(arcs()[0]!.getAttribute('data-selected')).toBe('true');
    expect(Number(lines()[0]!.getAttribute('stroke-width'))).toBeCloseTo(plain * 1.6, 5);
  });

  it('RF-20 (021) · 20.4, D-T32 (021): elegir desde fuera del mapa un Ápice que no está a la vista lo lleva a su celda', () => {
    const items = [...inZone(2, CENTRO), listed(3, { location: MEDELLIN })];
    const { rerender } = show(items);
    expect(level()).toBe('2');
    expect(map().querySelector('button.game-map__apice')).toBeNull();
    rerender(<GameMap items={items} selectedId="a3" onSelect={() => {}} />);
    expect(level()).toBe('0');
    expect(named('Ápice 3, agua, Idea').getAttribute('aria-pressed')).toBe('true');
  });

  it('RF-20 (021) · 20.4: elegir una celda que ya está a la vista no mueve el mapa', () => {
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
  /** La celda cae dentro de la ventana de respaldo (960 × 560): la traslación del mundo la deja a la vista. */
  const inView = (name: string): boolean => {
    const [, tx, ty] = /translate\((-?\d+)px, (-?\d+)px\)/.exec(world().style.transform)!.map(Number) as [number, number, number];
    const button = named(name);
    const x = leftOf(button) + tx;
    const y = topOf(button) + ty;
    return x >= 0 && y >= 0 && x + parseFloat(button.style.width) <= 960 && y + parseFloat(button.style.height) <= 560;
  };

  it('RF-3 (024) · 3.1: un «focus» nuevo acerca al nivel cercano con el Ápice a la vista', () => {
    const { rerender } = render(withFocus(null));
    expect(level()).toBe('2');
    rerender(withFocus({ token: 1, ids: ['a1'] }));
    expect(level()).toBe('0');
    expect(inView('Ápice 1, agua, Idea')).toBe(true);
  });

  it('RF-3 (024) · 3.2: con los Ápices de una Acción Común cercana, los deja a la vista a la vez', () => {
    const { rerender } = render(withFocus(null));
    rerender(withFocus({ token: 1, ids: ['a1', 'a2'] }));
    expect(level()).toBe('0');
    expect(inView('Ápice 1, agua, Idea')).toBe(true);
    expect(inView('Ápice 2, agua, Idea')).toBe(true);
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

  it('RF-3 (024) · D-12 (024): con `reserve` el Ápice queda más arriba, por la mitad de lo reservado', () => {
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

describe('GameMap · abrir una Acción Común la encuadra (RF-4 (024))', () => {
  const items = [...inZone(2, CENTRO), listed(3, { location: CHAPINERO }), listed(4, { location: MEDELLIN })];
  const road = (id: string, apiceIds: string[]): MapPath => ({ id, title: `Acción ${id}`, closed: false, apiceIds, axis: 'agua' });
  const paths = [road('cerca', ['a1', 'a2']), road('lejos', ['a1', 'a3']), road('solo', ['a1', 'desconocido']), road('nada', ['x', 'y'])];
  const open = (selectedPathId: string | null, selectedId: string | null = null) => (
    <GameMap items={items} paths={paths} selectedPathId={selectedPathId} selectedId={selectedId} onSelect={() => {}} />
  );
  const arc = (id: string) => map().querySelector(`g.game-map__arc[data-arc="${id}"]`);

  it('RF-4 (024) · 4.1: al elegir una Acción Común cercana, el mapa pasa al nivel cercano con sus Ápices a la vez a la vista', () => {
    const { rerender } = render(open(null));
    expect(level()).toBe('2');
    rerender(open('cerca'));
    expect(level()).toBe('0');
    expect(named('Ápice 1, agua, Idea')).toBeTruthy();
    expect(named('Ápice 2, agua, Idea')).toBeTruthy();
    expect(arc('cerca')).toBeTruthy();
  });

  it('RF-4 (024): con Ápices en zonas lejanas, el nivel es el más cercano en que caben y la ruta se dibuja', () => {
    const { rerender } = render(open(null));
    rerender(open('lejos'));
    expect(Number(level())).toBeGreaterThanOrEqual(0);
    expect(arc('lejos')).toBeTruthy();
  });

  it('RF-4 (024): con un solo Ápice a la vista, encuadra ese', () => {
    const { rerender } = render(open(null));
    rerender(open('solo'));
    expect(level()).toBe('0');
    expect(named('Ápice 1, agua, Idea')).toBeTruthy();
  });

  it('RF-4 (024), RF-18 (021) · 18.7: con ninguno a la vista, el mapa queda en el encuadre inicial', () => {
    const { rerender } = render(open(null));
    const before = world().style.transform;
    rerender(open('nada'));
    expect(level()).toBe('2');
    expect(world().style.transform).toBe(before);
  });

  it('RF-4 (024): no se repite mientras la Acción Común siga elegida, y una nueva sí encuadra', () => {
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

  it('RF-4 (024), RF-20 (021) · 20.4: el Ápice elegido desde el panel manda sobre la Acción Común', () => {
    const { rerender } = render(open(null));
    rerender(open('lejos', 'a4'));
    expect(named('Ápice 4, agua, Idea').getAttribute('aria-pressed')).toBe('true');
    expect(level()).toBe('0');
    const withRoad = world().style.transform;
    cleanup();
    const { rerender: again } = render(open(null));
    again(open(null, 'a4'));
    expect(world().style.transform).toBe(withRoad); // el mismo encuadre que sin la Acción Común
  });

  it('RF-4 (024) · 4.1: «Ver todo» deshace el encuadre de la Acción Común', () => {
    const { rerender } = render(open(null));
    rerender(open('cerca'));
    fireEvent.click(named('Ver todo'));
    expect(level()).toBe('2');
  });
});

describe('GameMap · el nombre del Ápice elegido y los rótulos de zona', () => {
  it('QA: el nombre del Ápice elegido entra primero en la lista de rótulos y el de la zona vecina se voltea, no queda tapado', () => {
    const apices: MapApice[] = [...inZone(2, CENTRO), ...inZone(2, VECINA, 3)].map((apice) => ({ id: apice.id, location: apice.location }));
    const layout = layoutMap(apices, 0);
    const [first, second] = layout.blocks;
    expect(second).toBeDefined();
    const viewport = { width: 960, height: 560 };
    const areas = labelAreas(viewport, 80, Math.round(viewport.width / 2 - second!.x), Math.round(viewport.height / 2 - second!.y));
    const base = planLabels(layout, [], areas, null);
    const label = base.zones.get(second!.key)!.rect;
    // Un Ápice cuyo nombre, a su derecha, cae justo sobre el rótulo de la zona.
    const spot = {
      id: 'x',
      x: label.left - 40,
      y: (label.top + label.bottom) / 2,
      points: [
        [label.left - 60, label.top],
        [label.left - 40, label.top],
        [label.left - 40, label.bottom],
        [label.left - 60, label.bottom],
      ],
    } as unknown as MapSpot;
    const plan = planLabels(layout, [], areas, null, [{ spot, name: 'Los cinco ejes' }]);
    const tag = plan.tags.get('x')!.rect;
    expect(rectsOverlap(tag, label), 'el nombre cae sobre el rótulo de la zona de antes').toBe(true);
    for (const block of layout.blocks) {
      expect(rectsOverlap(tag, plan.zones.get(block.key)!.rect), `zona ${block.code}`).toBe(false);
    }
    expect(plan.zones.get(second!.key)!.flipped).toBe(true);
    expect(first).toBeDefined();
  });
});

describe('GameMap · apagado (dimmedIds y lo elegido)', () => {
  const items = [...inZone(3, CENTRO), listed(4, { location: VECINA })];
  const arcPath = (id: string, apiceIds: string[]): MapPath => ({ id, title: `Acción ${id}`, closed: false, apiceIds, axis: 'agua' });
  const offCells = () => cells().filter((button) => button.getAttribute('data-off') === 'true');

  it('sin filtro ni elección, nada está apagado y la raíz no lleva data-picked', () => {
    show(items);
    expect(offCells()).toHaveLength(0);
    expect(map().getAttribute('data-picked')).toBeNull();
  });

  it('`dimmedIds` apaga las celdas, que siguen siendo botones, con un texto que no depende del color', () => {
    show(items, { dimmedIds: new Set(['a1', 'a2']) });
    expect(offCells().map((button) => button.getAttribute('aria-label'))).toEqual(['Ápice 1, agua, Idea', 'Ápice 2, agua, Idea']);
    for (const button of offCells()) {
      expect(button.getAttribute('aria-description')).toBe('Fuera de los filtros');
      expect(button.tagName).toBe('BUTTON');
    }
    expect(named('Ápice 3, agua, Idea').getAttribute('data-off')).toBeNull();
    expect(named('Ápice 3, agua, Idea').getAttribute('aria-description')).toBeNull();
    expect(map().getAttribute('data-picked')).toBeNull();
  });

  it('con un Ápice elegido la raíz lleva data-picked y se apaga todo salvo ese Ápice', () => {
    show(items, { selectedId: 'a2' });
    expect(map().getAttribute('data-picked')).toBe('true');
    expect(offCells().map((button) => button.getAttribute('aria-label')).sort()).toEqual(['Ápice 1, agua, Idea', 'Ápice 3, agua, Idea', 'Ápice 4, agua, Idea']);
    expect(named('Ápice 2, agua, Idea').getAttribute('data-off')).toBeNull();
    expect(named('Ápice 1, agua, Idea').getAttribute('aria-description')).toBe('Sin relación con lo elegido');
  });

  it('con una Acción Común elegida se apaga todo salvo sus Ápices y su Arco; los otros Arcos van apagados', () => {
    const paths = [arcPath('uno', ['a1', 'a4']), arcPath('dos', ['a2', 'a3'])];
    show(items, { paths, selectedPathId: 'uno', focus: { token: 1, ids: ['a1', 'a2', 'a3', 'a4'] } });
    expect(map().getAttribute('data-picked')).toBe('true');
    expect(offCells().map((button) => button.getAttribute('aria-label'))).toEqual(['Ápice 2, agua, Idea', 'Ápice 3, agua, Idea']);
    const arc = (id: string) => map().querySelector(`g.game-map__arc[data-arc="${id}"]`)!;
    expect(arc('uno').getAttribute('data-off')).toBeNull();
    expect(arc('uno').getAttribute('data-selected')).toBe('true');
    expect(arc('dos').getAttribute('data-off')).toBe('true');
    // Lo apagado se dibuja primero: nunca tapa lo vivo.
    const order = [...map().querySelectorAll('g.game-map__arc')].map((element) => element.getAttribute('data-arc'));
    expect(order).toEqual(['dos', 'uno']);
  });

  it('QA celda 1 · 1: el Arco apagado va en la trama, bajo los Ápices y el «+N»; el vivo, sobre ellos', () => {
    const many = [...inZone(9, CENTRO), listed(20, { location: VECINA })];
    const paths = [arcPath('uno', ['a1', 'a20']), arcPath('dos', ['a2', 'a3'])];
    show(many, { paths, selectedPathId: 'uno', focus: { token: 1, ids: ['a1', 'a2', 'a3', 'a20'] } });
    const world = map().querySelector('.game-map__world')!;
    const children = [...world.querySelectorAll('svg.game-map__arcs, button.game-map__cell')];
    const off = world.querySelector('svg.game-map__arcs[data-layer="off"]')!;
    const live = world.querySelector('svg.game-map__arcs[data-layer="live"]')!;
    expect(off.querySelector('g.game-map__arc[data-arc="dos"]')).not.toBeNull();
    expect(off.querySelector('g.game-map__arc[data-arc="uno"]')).toBeNull();
    expect(live.querySelector('g.game-map__arc[data-arc="uno"]')).not.toBeNull();
    expect(live.querySelector('g.game-map__arc[data-arc="dos"]')).toBeNull();
    const cellsOnly = children.filter((element) => element.tagName === 'BUTTON');
    expect(cellsOnly.length).toBeGreaterThan(0);
    for (const cell of cellsOnly) {
      expect(children.indexOf(off)).toBeLessThan(children.indexOf(cell));
      expect(children.indexOf(live)).toBeGreaterThan(children.indexOf(cell));
    }
    // Todas las celdas, también el «+N», quedan entre las dos capas.
    expect(cellsOnly.some((cell) => /más en esta zona/.test(cell.getAttribute('aria-label') ?? ''))).toBe(true);
  });

  it('un Arco cuyos Ápices están todos fuera del filtro se apaga; el borrador nunca', () => {
    const paths = [arcPath('uno', ['a1', 'a4']), { ...arcPath('borrador', ['a2', 'a3']), draft: true }];
    show(items, { paths, dimmedIds: new Set(['a1', 'a2', 'a3', 'a4']), focus: { token: 1, ids: ['a1', 'a2', 'a3', 'a4'] } });
    const arc = (id: string) => map().querySelector(`g.game-map__arc[data-arc="${id}"]`)!;
    expect(arc('uno').getAttribute('data-off')).toBe('true');
    expect(arc('borrador').getAttribute('data-off')).toBeNull();
  });

  it('el «+N» se apaga solo si todos los Ápices que reúne están apagados', () => {
    const many = inZone(9, CENTRO);
    const all = new Set(many.map((item) => item.id));
    const { unmount } = show(many, { dimmedIds: new Set(['a1']) });
    expect(screen.getByRole('button', { name: /más en esta zona/ }).getAttribute('data-off')).toBeNull();
    unmount();
    show(many, { dimmedIds: all });
    const more = screen.getByRole('button', { name: /más en esta zona/ });
    expect(more.getAttribute('data-off')).toBe('true');
    expect(more.getAttribute('aria-description')).toBe('Fuera de los filtros');
  });

  it('lo apagado no usa colores literales ni deja de ser un bloque', () => {
    const { container } = show(items, { dimmedIds: new Set(['a1']), selectedId: 'a2' });
    expectBlocks(container);
    for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(element.getAttribute('style')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|url\(/i);
    }
  });
});

describe('GameMap · nivel llevado desde fuera y controles', () => {
  const items = [...inZone(2, CENTRO), listed(3, { location: MEDELLIN })];

  it('`hideZoomControls` oculta Acercar, Alejar y Ver todo; por defecto se muestran', () => {
    const { unmount } = show(items);
    expect(screen.queryByRole('button', { name: 'Acercar' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Alejar' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver todo' })).not.toBeNull();
    unmount();
    show(items, { hideZoomControls: true });
    for (const name of ['Acercar', 'Alejar', 'Ver todo']) expect(screen.queryByRole('button', { name })).toBeNull();
    // El teclado sigue cambiando el nivel.
    fireEvent.keyDown(map(), { key: '+' });
    expect(level()).toBe('1');
  });

  it('con `level` el mapa lo sigue y avisa con `onLevelChange` sin cambiarlo por su cuenta', () => {
    const onLevelChange = vi.fn();
    const { rerender } = render(<GameMap items={items} selectedId={null} onSelect={() => {}} level={2} onLevelChange={onLevelChange} />);
    expect(level()).toBe('2');
    fireEvent.click(named('Acercar'));
    expect(onLevelChange).toHaveBeenLastCalledWith(1);
    expect(level()).toBe('2');
    rerender(<GameMap items={items} selectedId={null} onSelect={() => {}} level={1} onLevelChange={onLevelChange} />);
    expect(level()).toBe('1');
    rerender(<GameMap items={items} selectedId={null} onSelect={() => {}} level={0} onLevelChange={onLevelChange} />);
    expect(level()).toBe('0');
  });

  it('«E3 · Celda»: con `level`, cambiar de nivel desde fuera nunca deja el mapa sin celdas ni grupos a la vista', () => {
    const apices = [...inZone(3, CENTRO), ...inZone(2, CHAPINERO, 10), ...inZone(2, MEDELLIN, 20)];
    const content = () => map().querySelectorAll('button.game-map__apice, button.game-map__group, .game-map__group').length;
    const view = (level: 0 | 1 | 2) => <GameMap items={apices} selectedId={null} onSelect={() => {}} level={level} onLevelChange={() => {}} />;
    const { rerender } = render(view(2));
    for (const next of [0, 1, 0, 2, 1, 0] as const) {
      rerender(view(next));
      expect(level()).toBe(String(next));
      expect(content()).toBeGreaterThan(0);
    }
  });

  it('sin `level` el mapa lleva el nivel solo y avisa de cada cambio', () => {
    const onLevelChange = vi.fn();
    show(items, { onLevelChange });
    expect(level()).toBe('2');
    fireEvent.click(named('Acercar'));
    expect(level()).toBe('1');
    expect(onLevelChange).toHaveBeenLastCalledWith(1);
  });

  it('con `level`, «Ver todo» avisa del nivel del encuadre inicial', () => {
    const onLevelChange = vi.fn();
    render(<GameMap items={items} selectedId={null} onSelect={() => {}} level={0} onLevelChange={onLevelChange} />);
    fireEvent.click(named('Ver todo'));
    expect(onLevelChange).toHaveBeenLastCalledWith(2);
  });
});

describe('GameMap · onAnchor', () => {
  const items = inZone(3, CENTRO);
  const frames: FrameRequestCallback[] = [];
  const realRaf = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  const useFrames = () => {
    frames.length = 0;
    globalThis.requestAnimationFrame = (callback) => frames.push(callback);
    globalThis.cancelAnimationFrame = () => {};
  };
  const flush = () => act(() => {
    const pending = frames.splice(0);
    for (const callback of pending) callback(0);
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = realRaf;
    globalThis.cancelAnimationFrame = realCancel;
  });

  it('sin elección avisa con null una sola vez (o ninguna), nunca con un punto', () => {
    useFrames();
    const onAnchor = vi.fn();
    show(items, { onAnchor });
    flush();
    for (const call of onAnchor.mock.calls) expect(call[0]).toBeNull();
    expect(onAnchor.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('con un Ápice elegido da el punto medio del borde de abajo de su celda, 4 px más abajo, en coordenadas de la ventana', () => {
    useFrames();
    const onAnchor = vi.fn();
    const { rerender } = show(items, { onAnchor });
    flush();
    onAnchor.mockClear();
    const region = map();
    region.getBoundingClientRect = () => ({ left: 100, top: 50, right: 1060, bottom: 610, width: 960, height: 560, x: 100, y: 50, toJSON: () => ({}) });
    rerender(<GameMap items={items} selectedId="a2" onSelect={() => {}} onAnchor={onAnchor} />);
    flush();
    expect(onAnchor).toHaveBeenCalledTimes(1);
    const point = onAnchor.mock.calls[0]![0] as { x: number; y: number };
    // La celda de a2 en el lienzo: el punto medio de sus vértices más bajos, 4 px más abajo, más lo que mueve el lienzo.
    const spot = layoutMap(items.map((item) => ({ id: item.id, location: item.location })), 0).blocks.flatMap((block) => block.spots).find((candidate) => candidate.id === 'a2')!;
    const low = Math.max(...spot.points.map(([, y]) => y));
    const edge = spot.points.filter(([, y]) => y >= low - 0.5);
    const middle = edge.reduce((sum, [x]) => sum + x, 0) / edge.length;
    const shift = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(world().style.transform)!;
    expect(point.x).toBeCloseTo(100 + middle + Number(shift[1]) , 0);
    expect(point.y).toBeCloseTo(50 + low + 4 + Number(shift[2]), 0);
  });

  it('solo avisa de nuevo si el punto se mueve más de 0,5 px', () => {
    useFrames();
    const onAnchor = vi.fn();
    const { rerender } = show(items, { onAnchor, selectedId: 'a2' });
    flush();
    onAnchor.mockClear();
    rerender(<GameMap items={items} selectedId="a2" onSelect={() => {}} onAnchor={onAnchor} />);
    flush();
    expect(onAnchor).not.toHaveBeenCalled();
  });

  it('con una Acción Común elegida da la muestra central de su Arco, y al quitar la elección vuelve a null', () => {
    useFrames();
    const onAnchor = vi.fn();
    const paths: MapPath[] = [{ id: 'c1', title: 'Agua lluvia', closed: false, apiceIds: ['a1', 'a2', 'a3'], axis: 'agua' }];
    const { rerender } = show(items, { onAnchor, paths, selectedPathId: 'c1' });
    flush();
    const last = onAnchor.mock.calls.at(-1)![0] as { x: number; y: number } | null;
    expect(last).not.toBeNull();
    expect(Number.isFinite(last!.x) && Number.isFinite(last!.y)).toBe(true);
    rerender(<GameMap items={items} paths={paths} selectedPathId={null} selectedId={null} onSelect={() => {}} onAnchor={onAnchor} />);
    flush();
    expect(onAnchor.mock.calls.at(-1)![0]).toBeNull();
  });
});

describe('GameMap · rótulos del Arco junto a las celdas', () => {
  it('los rótulos de zona esquivan las celdas de Ápice vecinas', () => {
    const apices: MapApice[] = [...inZone(3, CENTRO), ...inZone(3, VECINA, 4)].map((apice) => ({ id: apice.id, location: apice.location }));
    const layout = layoutMap(apices, 0);
    const viewport = { width: 960, height: 560 };
    const first = layout.blocks[0]!;
    const areas = labelAreas(viewport, 80, Math.round(viewport.width / 2 - first.x), Math.round(viewport.height / 2 - first.y));
    const plan = planLabels(layout, [], areas, null);
    for (const block of layout.blocks) {
      const rect = plan.zones.get(block.key)!.rect;
      for (const other of layout.blocks) {
        for (const spot of other.spots) {
          const xs = spot.points.map(([x]) => x);
          const ys = spot.points.map(([, y]) => y);
          const cell = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
          expect(rectsOverlap(rect, cell), `zona ${block.code} contra celda ${spot.id}`).toBe(false);
        }
      }
    }
  });
});
