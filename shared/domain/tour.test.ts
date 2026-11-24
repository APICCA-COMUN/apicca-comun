// T-44 (021) · RF-22 (021), RF-26 (021) · 26.2, D-T38 (021): los pasos del primer recorrido.
import { describe, expect, it } from 'vitest';
import { layoutMap } from './hexmap';
import { tourFocus, tourReserve, tourSteps, type TourFocusApice, type TourFocusPath } from './tour';

describe('tourSteps', () => {
  it('RF-22 (021) · 22.1: con ápices y caminos son tres pasos, en orden: mirar un ápice, mirar un camino y construir', () => {
    expect(tourSteps({ apices: 4, paths: 1, signedIn: true }).map((step) => step.key)).toEqual(['apice', 'camino', 'construir']);
  });

  it('RF-22 (021) · 22.3: sin caminos omite ese paso; sin ápices, también el de mirar un ápice', () => {
    expect(tourSteps({ apices: 2, paths: 0, signedIn: true }).map((step) => step.key)).toEqual(['apice', 'construir']);
    expect(tourSteps({ apices: 0, paths: 0, signedIn: false }).map((step) => step.key)).toEqual(['construir']);
  });

  it('RF-26 (021) · 26.2: sin sesión, el paso de construir dice antes que hace falta unirse', () => {
    const [visitor] = tourSteps({ apices: 0, paths: 0, signedIn: false });
    const [person] = tourSteps({ apices: 0, paths: 0, signedIn: true });
    expect(visitor!.text).toMatch(/únete|unirte/i);
    expect(person!.text).not.toMatch(/únete|unirte/i);
  });

  it('RF-26 (021) · 26.1: cada paso tiene título y texto, y nombra solo controles que el mapa tiene', () => {
    for (const step of tourSteps({ apices: 3, paths: 2, signedIn: false })) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.text.length).toBeGreaterThan(0);
    }
    const text = tourSteps({ apices: 3, paths: 2, signedIn: true }).map((step) => step.text).join(' ');
    expect(text).toContain('Construir ápice');
    expect(text).toContain('Trazar camino');
  });
});

// T-11 (024) · RF-3 (024), D-1 (024), D-T3 (024): a qué ápices lleva el mapa cada paso del recorrido.
const CENTRO = { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 };
const VECINA = { cell: '8766e0905ffffff', lat: 4.61069, lng: -74.103401 };
const CHAPINERO = { cell: '8766e42d2ffffff', lat: 4.649886, lng: -74.060244 };
const SUBA = { cell: '8766e4281ffffff', lat: 4.74316, lng: -74.091715 };
const MEDELLIN = { cell: '876619d92ffffff', lat: 6.243305, lng: -75.585547 };

type Zone = typeof CENTRO;
const at = (id: string, zone: Zone, name = `Ápice ${id}`): TourFocusApice => ({
  id,
  name,
  location: { lat: zone.lat, lng: zone.lng, precision: 'approximate', zone },
});
const nowhere = (id: string): TourFocusApice => ({ id, name: `Ápice ${id}`, location: null });
const road = (id: string, apiceIds: string[]): TourFocusPath => ({ id, apiceIds });

const WIDE = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 500 };

describe('tourFocus', () => {
  it('RF-3 (024) · 3.1: el paso de mirar un ápice lleva a un ápice con su edificio a la vista', () => {
    const apices = [at('b', CHAPINERO), at('a', CENTRO), at('c', SUBA)];
    const { apice } = tourFocus({ apices, paths: [], viewport: WIDE });
    expect(apice).toHaveLength(1);
    const layout = layoutMap(apices, 0);
    const spots = layout.blocks.flatMap((block) => block.spots.map((spot) => spot.id));
    expect(spots).toContain(apice[0]);
  });

  it('RF-3 (024) · 3.1: toma el primero en el orden estable del mapa, el de la manzana más al norte', () => {
    // SUBA queda al norte de CHAPINERO y de CENTRO: su manzana va primero (orden por `y`).
    const { apice } = tourFocus({ apices: [at('a', CENTRO), at('b', CHAPINERO), at('c', SUBA)], paths: [] });
    expect(apice).toEqual(['c']);
  });

  it('RF-3 (024) · 3.1: nunca toma un ápice que quedó dentro de un «+n»', () => {
    // Con nueve ápices en una manzana, solo los siete primeros, en orden por id, tienen edificio.
    const many = Array.from({ length: 9 }, (_, index) => at(`apice-${index}`, CENTRO));
    const [block] = layoutMap(many, 0).blocks;
    expect(block!.more).toBe(2);
    const { apice } = tourFocus({ apices: many, paths: [] });
    expect(block!.spots.map((spot) => spot.id)).toContain(apice[0]);
    expect(['apice-7', 'apice-8']).not.toContain(apice[0]);
  });

  it('RF-3 (024) · 3.1: sin ápices con ubicación toma uno del terreno', () => {
    const { apice } = tourFocus({ apices: [nowhere('z'), nowhere('m')], paths: [] });
    expect(apice).toEqual(['m']);
  });

  it('RF-3 (024) · 3.1: salta el ápice sin nombre, que no tendría rótulo a la vista', () => {
    const { apice } = tourFocus({ apices: [at('c', SUBA, '  '), at('a', CENTRO)], paths: [] });
    expect(apice).toEqual(['a']);
  });

  it('RF-3 (024) · 3.2: el paso de mirar un camino lleva a los ápices de un camino que se dibuja, en el orden del camino', () => {
    const apices = [at('a', CENTRO), at('b', CHAPINERO), at('c', SUBA)];
    const { camino } = tourFocus({ apices, paths: [road('uno', ['c', 'a', 'b'])], viewport: WIDE });
    expect(camino).toEqual(['c', 'a', 'b']);
  });

  it('RF-3 (024) · 3.2: no elige un camino que no se dibuja en el nivel cercano', () => {
    const many = Array.from({ length: 9 }, (_, index) => at(`apice-${index}`, CENTRO));
    const apices = [...many, at('s', SUBA)];
    const hidden = road('a-oculto', ['apice-7', 'apice-8']); // los dos van en el «+n»: un solo punto
    const alone = road('b-solo', ['apice-0', 'desconocido']); // un solo ápice a la vista
    const drawn = road('c-visible', ['apice-0', 's']);
    expect(tourFocus({ apices, paths: [hidden, alone, drawn], viewport: WIDE }).camino).toEqual(['apice-0', 's']);
    expect(tourFocus({ apices, paths: [hidden, alone], viewport: WIDE }).camino).toEqual([]);
  });

  it('RF-3 (024) · 3.2: prefiere el primer camino cuyos ápices caben en la ventana', () => {
    const apices = [at('a', CENTRO), at('b', VECINA), at('m', MEDELLIN)];
    const far = road('a-lejos', ['a', 'm']);
    const near = road('b-cerca', ['a', 'b']);
    expect(tourFocus({ apices, paths: [far, near], viewport: WIDE }).camino).toEqual(['a', 'b']);
  });

  it('RF-3 (024) · 3.2: si ninguno cabe, toma el primero que se dibuje', () => {
    const apices = [at('a', CENTRO), at('b', CHAPINERO), at('m', MEDELLIN)];
    const far = road('a-lejos', ['a', 'm']);
    const farther = road('b-lejos', ['b', 'm']);
    expect(tourFocus({ apices, paths: [farther, far], viewport: WIDE }).camino).toEqual(['a', 'm']);
  });

  it('RF-3 (024) · 3.2: el borrador de «Trazar camino» no cuenta', () => {
    const apices = [at('a', CENTRO), at('b', CHAPINERO)];
    expect(tourFocus({ apices, paths: [{ ...road('borrador', ['a', 'b']), draft: true }] }).camino).toEqual([]);
  });

  it('RF-3 (024) · 3.2: en un teléfono angosto, un camino que ocupa toda una manzana de edificios sigue cabiendo', () => {
    const apices = [at('a', CENTRO), at('b', CENTRO), at('c', CENTRO)];
    expect(tourFocus({ apices, paths: [road('uno', ['a', 'b', 'c'])], viewport: PHONE }).camino).toEqual(['a', 'b', 'c']);
  });

  it('RF-3 (024) · 3.1: sin ápices o sin caminos devuelve listas vacías, y el paso se omite como hoy (RF-22 (021) · 22.3)', () => {
    expect(tourFocus({ apices: [], paths: [] })).toEqual({ apice: [], camino: [] });
    expect(tourFocus({ apices: [at('a', CENTRO)], paths: [] })).toEqual({ apice: ['a'], camino: [] });
  });

  it('RF-3 (024) · 3.1: el resultado no depende del orden de llegada de los ápices ni de los caminos', () => {
    const apices = [at('a', CENTRO), at('b', CHAPINERO), at('c', SUBA), nowhere('z')];
    const paths = [road('p2', ['b', 'c']), road('p1', ['a', 'b'])];
    const straight = tourFocus({ apices, paths, viewport: WIDE });
    const reversed = tourFocus({ apices: [...apices].reverse(), paths: [...paths].reverse(), viewport: WIDE });
    expect(reversed).toEqual(straight);
    expect(straight.camino).toEqual(['a', 'b']); // p1 antes que p2, por id
  });
});

// T-13 (024) · RF-3 (024), D-12 (024), D-T4b (024): cuánto del borde de abajo reserva el encuadre del recorrido.
describe('tourReserve', () => {
  const PHONE_MAP = { width: 390, height: 559 };
  /** La tarjeta del teléfono: del borde izquierdo a 80 px del derecho, y de 273 px de alto sobre el borde de abajo. */
  const phoneCard = { left: 12, right: 310, top: 559 - 285 };

  it('RF-3 (024) · D-12 (024): en el teléfono, la tarjeta cruza el centro y se reserva desde su borde de arriba hasta el de abajo', () => {
    expect(tourReserve(PHONE_MAP, phoneCard)).toBe(285);
  });

  it('RF-3 (024) · D-12 (024): a 1280 la tarjeta queda a la izquierda, no tapa el centro y no se reserva nada', () => {
    expect(tourReserve({ width: 1280, height: 800 }, { left: 12, right: 460, top: 520 })).toBe(0);
  });

  it('RF-3 (024) · D-12 (024): sin tarjeta (se saltó o terminó el recorrido) no se reserva nada', () => {
    expect(tourReserve(PHONE_MAP, null)).toBe(0);
  });

  it('RF-3 (024) · D-12 (024): una tarjeta que no sube del borde de abajo, o que lo rebasa, no reserva espacio negativo', () => {
    expect(tourReserve(PHONE_MAP, { left: 12, right: 310, top: 600 })).toBe(0);
  });

  it('RF-3 (024) · D-12 (024): la reserva no se come la ventana: deja libre al menos el 40 % de su alto', () => {
    expect(tourReserve({ width: 390, height: 400 }, { left: 12, right: 310, top: 20 })).toBe(240);
  });
});
