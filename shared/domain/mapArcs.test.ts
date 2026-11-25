// El Arco de una Acción Común: orden de las paradas, tramos curvos que esquivan Ápices, recorte en los extremos, medidas del
// trazo y lugar del rótulo.
import { describe, expect, it } from 'vitest';
import {
  ARC_BENDS,
  arcDiscR,
  arcHalo,
  arcSegment,
  arcStroke,
  buildArc,
  orderArcStops,
  placeArcLabel,
  type Arc,
  type ArcPoint,
} from './mapArcs';
import { pathLabelWidth, type LabelRect } from './mapPaths';

const R = 46;
const NONE = { apices: [] as ArcPoint[] };
const dist = (a: ArcPoint, b: ArcPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** El punto de control de un `d` «M a Q c b». */
function numbersOf(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

describe('mapArcs · orden de las paradas', () => {
  const stops = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 200, y: 110 },
    { x: 500, y: 100 },
  ];

  it('empieza por la parada más lejana del centroide y sigue por el vecino más cercano', () => {
    // Centroide en x = 275: la de x = 500 está a 225 y la de x = 100 a 175.
    expect(orderArcStops(stops)).toEqual([3, 1, 2, 0]);
  });

  it('es determinista: el mismo resultado siempre y los empates los gana el índice menor', () => {
    expect(orderArcStops(stops)).toEqual(orderArcStops(stops));
    // Dos paradas igual de lejanas del centroide: gana la primera.
    expect(orderArcStops([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toEqual([0, 1]);
    // Dos vecinos a igual distancia de la última: gana el de menor índice.
    expect(orderArcStops([{ x: -100, y: 0 }, { x: 0, y: 50 }, { x: 0, y: -50 }, { x: 300, y: 0 }]).slice(0, 2)).toEqual([3, 1]);
  });

  it('quita los puntos coincidentes y se queda con el primero', () => {
    expect(orderArcStops([{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 80, y: 0 }])).toEqual([0, 2]);
  });
});

describe('mapArcs · paradas insuficientes', () => {
  it('con 0 o 1 paradas, o con todas coincidentes, no hay Arco', () => {
    expect(buildArc([], R, NONE)).toBeNull();
    expect(buildArc([{ x: 10, y: 10 }], R, NONE)).toBeNull();
    expect(buildArc([{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10.1, y: 10 }], R, NONE)).toBeNull();
  });

  it('sin radio no hay Arco', () => {
    expect(buildArc([{ x: 0, y: 0 }, { x: 300, y: 0 }], 0, NONE)).toBeNull();
  });
});

describe('mapArcs · tramos', () => {
  const stops = [{ id: 'a', x: 100, y: 200 }, { id: 'b', x: 400, y: 200 }, { id: 'c', x: 400, y: 450 }];

  it('cada tramo usa una de las dos combas y un lado', () => {
    const arc = buildArc(stops, R, NONE)!;
    expect(arc.segments.length).toBe(arc.order.length - 1);
    for (const segment of arc.segments) {
      expect(ARC_BENDS).toContain(segment.k);
      expect([1, -1]).toContain(segment.side);
      expect(segment.samples.length).toBeGreaterThan(10);
    }
    // Sin nada que pisar gana la comba pequeña.
    expect(arc.segments.every((segment) => segment.k === 0.16)).toBe(true);
    expect(arc.pisa).toBe(0);
  });

  it('el path solo lleva M, Q y números redondeados a 0,1 px', () => {
    const arc = buildArc(stops, R, NONE)!;
    for (const segment of arc.segments) {
      expect(segment.d).toMatch(/^M[-\d. ]+Q[-\d. ]+$/);
      expect(segment.d).not.toMatch(/[^MQ\d.\- ]/);
      expect(segment.d).not.toContain('NaN');
      expect(numbersOf(segment.d)).toHaveLength(6);
      for (const value of numbersOf(segment.d)) expect(Math.round(value * 10) / 10).toBe(value);
    }
  });

  it('con un Ápice sobre el lado obvio, elige el otro lado (y no pisa nada)', () => {
    const a = { x: 100, y: 200 };
    const b = { x: 500, y: 200 };
    // Con a→b hacia la derecha, el lado 1 va hacia abajo (y crece): ponemos el Ápice ahí, a media curva.
    const abajo = buildArc([a, b], R, { apices: [a, b, { x: 300, y: 200 + 400 * 0.16 / 2 + 5 }] })!;
    expect(abajo.segments[0]!.pisa).toBe(0);
    // Sea cual sea el sentido del tramo, la curva elegida queda arriba (y menor) en pantalla.
    const samples = abajo.segments[0]!.samples;
    const middle = samples[Math.floor(samples.length / 2)]!;
    expect(middle.y).toBeLessThan(200);

    // Lo mismo con el Ápice arriba: la curva se va hacia abajo.
    const arriba = buildArc([a, b], R, { apices: [{ x: 300, y: 200 - 400 * 0.16 / 2 - 5 }] })!;
    expect(arriba.segments[0]!.pisa).toBe(0);
    const samplesUp = arriba.segments[0]!.samples;
    expect(samplesUp[Math.floor(samplesUp.length / 2)]!.y).toBeGreaterThan(200);
  });

  it('si no hay forma de esquivar, cuenta los Ápices pisados', () => {
    const a = { x: 100, y: 200 };
    const b = { x: 500, y: 200 };
    const arc = buildArc([a, b], R, { apices: [{ x: 300, y: 200 }, { x: 300, y: 230 }, { x: 300, y: 170 }, { x: 300, y: 140 }, { x: 300, y: 260 }] })!;
    expect(arc.pisa).toBeGreaterThan(0);
    expect(arc.pisa).toBe(arc.segments.reduce((sum, segment) => sum + segment.pisa, 0));
  });

  it('las paradas propias no cuentan como pisadas', () => {
    const arc = buildArc(stops, R, { apices: stops })!;
    expect(arc.pisa).toBe(0);
  });

  it('el recorte deja los extremos a 0,78 R de los centros', () => {
    for (const radius of [46, 20]) {
      const arc = buildArc(stops, radius, NONE)!;
      arc.segments.forEach((segment, index) => {
        const from = arc.stops[index]!;
        const to = arc.stops[index + 1]!;
        expect(Math.abs(dist(segment.samples[0]!, from) - 0.78 * radius)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(dist(segment.samples[segment.samples.length - 1]!, to) - 0.78 * radius)).toBeLessThanOrEqual(0.5);
        // El `d` es la misma curva: sus extremos coinciden con los de las muestras (a 0,1 px).
        const [x0, y0, , , x1, y1] = numbersOf(segment.d) as [number, number, number, number, number, number];
        expect(Math.hypot(x0 - segment.samples[0]!.x, y0 - segment.samples[0]!.y)).toBeLessThan(0.1);
        expect(Math.hypot(x1 - segment.samples[segment.samples.length - 1]!.x, y1 - segment.samples[segment.samples.length - 1]!.y)).toBeLessThan(0.1);
      });
    }
  });

  it('la subcurva es exacta: el punto medio del path coincide con la muestra del medio', () => {
    const arc = buildArc([{ x: 0, y: 0 }, { x: 300, y: 80 }], R, NONE)!;
    const segment = arc.segments[0]!;
    const [x0, y0, cx, cy, x1, y1] = numbersOf(segment.d) as [number, number, number, number, number, number];
    const mid = { x: (x0 + 2 * cx + x1) / 4, y: (y0 + 2 * cy + y1) / 4 };
    const sample = segment.samples[segment.samples.length >> 1]!;
    expect(dist(mid, sample)).toBeLessThan(0.3);
  });

  it('un par de paradas tan junto que no queda curva fuera de los recortes no lleva tramo', () => {
    const arc = buildArc([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 110, y: 0 }], R, NONE)!;
    expect(arc.order).toHaveLength(3);
    expect(arc.segments).toHaveLength(1);
    expect(arc.discs).toHaveLength(3);
  });

  it('discos: uno por parada, en los puntos de recorte (la primera, en el del tramo que sale)', () => {
    const arc = buildArc(stops, R, NONE)!;
    expect(arc.discs).toHaveLength(arc.order.length);
    const first = arc.segments[0]!.samples[0]!;
    expect(dist(arc.discs[0]!, first)).toBeLessThan(0.1);
    arc.segments.forEach((segment, index) => {
      const last = segment.samples[segment.samples.length - 1]!;
      expect(dist(arc.discs[index + 1]!, last)).toBeLessThan(0.1);
    });
    for (const disc of arc.discs) expect(disc.r).toBe(arcDiscR(R));
  });

  it('arcSegment sirve entre dos puntos sueltos, con o sin recorte', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    expect(arcSegment(a, a, 0.16, 1)).toBeNull();
    const whole = arcSegment(a, b, 0.32, -1)!;
    expect(whole.samples[0]).toEqual(a);
    expect(whole.samples[whole.samples.length - 1]!.x).toBeCloseTo(100, 6);
    // k = 0,32 con lado -1 va hacia arriba (y menor).
    expect(whole.samples[Math.floor(whole.samples.length / 2)]!.y).toBeLessThan(0);
    const cut = arcSegment(a, b, 0.32, -1, 10)!;
    expect(Math.abs(dist(cut.samples[0]!, a) - 10)).toBeLessThanOrEqual(0.5);
    expect(arcSegment(a, { x: 15, y: 0 }, 0.16, 1, 10)).toBeNull();
  });
});

describe('mapArcs · medidas', () => {
  it('trazo, halo y disco para R = 46', () => {
    expect(arcStroke(46)).toBeCloseTo(1.8, 10);
    expect(arcHalo(46)).toBeCloseTo(6.8, 10);
    expect(arcDiscR(46)).toBeCloseTo(5.5, 10);
  });

  it('trazo, halo y disco para R = 20 (el trazo no baja de 1,4)', () => {
    expect(arcStroke(20)).toBe(1.4);
    expect(arcHalo(20)).toBeCloseTo(6.4, 10);
    expect(arcDiscR(20)).toBeCloseTo((4.5 * 20) / 46 + 1, 10);
  });
});

describe('mapArcs · rótulo', () => {
  const view: LabelRect = { left: 0, top: 0, right: 900, bottom: 700 };
  const arc = buildArc([{ x: 200, y: 350 }, { x: 600, y: 350 }], R, NONE)! as Arc;
  const text = 'Cosecha de agua';
  const rectOf = (box: { x: number; y: number; w: number; h: number }): LabelRect => ({ left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h });
  const overlapsApice = (rect: LabelRect, apice: ArcPoint) => {
    const x = Math.min(Math.max(apice.x, rect.left), rect.right);
    const y = Math.min(Math.max(apice.y, rect.top), rect.bottom);
    return Math.hypot(apice.x - x, apice.y - y) < R;
  };

  it('mide 24 px de alto y glifo + 6 + el ancho del texto', () => {
    const box = placeArcLabel(arc, text, { apices: [], rects: [] }, view)!;
    expect(box.h).toBe(24);
    expect(box.w).toBe(14 + 6 + pathLabelWidth(text.length));
  });

  it('no solapa Ápices, rótulos dados ni sale de la ventana', () => {
    const apices = [{ x: 400, y: 330 }, { x: 300, y: 500 }, { x: 500, y: 200 }];
    const taken: LabelRect[] = [{ left: 330, top: 200, right: 520, bottom: 224 }];
    const box = placeArcLabel(arc, text, { apices, rects: taken }, view)!;
    expect(box).not.toBeNull();
    const rect = rectOf(box);
    for (const apice of [...apices, ...arc.stops]) expect(overlapsApice(rect, apice)).toBe(false);
    for (const area of taken) {
      const separated = rect.right + 4 <= area.left || rect.left >= area.right + 4 || rect.bottom + 4 <= area.top || rect.top >= area.bottom + 4;
      expect(separated).toBe(true);
    }
    expect(rect.left).toBeGreaterThanOrEqual(view.left);
    expect(rect.right).toBeLessThanOrEqual(view.right);
    expect(rect.top).toBeGreaterThanOrEqual(view.top);
    expect(rect.bottom).toBeLessThanOrEqual(view.bottom);
  });

  it('es determinista', () => {
    const occupied = { apices: [{ x: 400, y: 300 }], rects: [] };
    expect(placeArcLabel(arc, text, occupied, view)).toEqual(placeArcLabel(arc, text, occupied, view));
  });

  it('una ventana donde el rótulo no cabe entero da null', () => {
    expect(placeArcLabel(arc, text, { apices: [], rects: [] }, { left: 190, top: 330, right: 330, bottom: 370 })).toBeNull();
  });

  it('sin sitio libre da null', () => {
    const everything: LabelRect[] = [{ left: -1000, top: -1000, right: 2000, bottom: 2000 }];
    expect(placeArcLabel(arc, text, { apices: [], rects: everything }, view)).toBeNull();
  });
});
