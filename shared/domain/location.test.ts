import { describe, expect, it } from 'vitest';
import {
  APPROXIMATE_GRID,
  approximateZone,
  DEFAULT_PRECISION,
  displayLocation,
  groupByLocation,
  raisesLocation,
  validateCoordinates,
  zoneKey,
} from './location';
import { isErrorCode } from './messages';

describe('shared/domain/location · validateCoordinates', () => {
  it('RF-9 (001): acepta coordenadas válidas y las devuelve como punto', () => {
    expect(validateCoordinates(4.711, -74.0721)).toEqual({ ok: true, value: { lat: 4.711, lng: -74.0721 } });
  });

  it('RF-9 (001): acepta los extremos del rango', () => {
    for (const [lat, lng] of [[90, 180], [-90, -180], [0, 0]] as const) {
      expect(validateCoordinates(lat, lng).ok, `${lat},${lng}`).toBe(true);
    }
  });

  it('RF-9 (001): rechaza fuera de rango con un código tipificado', () => {
    for (const [lat, lng] of [[90.0001, 0], [-90.1, 0], [0, 180.5], [0, -181]] as const) {
      const result = validateCoordinates(lat, lng);
      expect(result.ok, `${lat},${lng}`).toBe(false);
      if (!result.ok) expect(isErrorCode(result.code)).toBe(true);
    }
  });

  it('RF-9 (001): rechaza lo que no es un número finito', () => {
    for (const bad of [NaN, Infinity, -Infinity, '4.7', null, undefined, {}]) {
      expect(validateCoordinates(bad, 0).ok, String(bad)).toBe(false);
      expect(validateCoordinates(0, bad).ok, String(bad)).toBe(false);
    }
  });

  it('RF-9 (001): -0 se normaliza a 0', () => {
    const result = validateCoordinates(-0, -0);
    expect(result.ok && Object.is(result.value.lat, 0) && Object.is(result.value.lng, 0)).toBe(true);
  });
});

describe('shared/domain/location · approximateZone', () => {
  it('RF-9 (001): devuelve el centro de la celda de 0,01°', () => {
    expect(APPROXIMATE_GRID).toBe(0.01);
    expect(approximateZone({ lat: 4.7113, lng: -74.0721 })).toEqual({ lat: 4.715, lng: -74.075 });
    expect(approximateZone({ lat: 0, lng: 0 })).toEqual({ lat: 0.005, lng: 0.005 });
    expect(approximateZone({ lat: -0.0001, lng: -0.0001 })).toEqual({ lat: -0.005, lng: -0.005 });
  });

  it('RF-9 (001): todos los puntos de una celda dan el mismo centro', () => {
    const centers = new Set<string>();
    for (const dLat of [0, 0.001, 0.0049, 0.0099]) {
      for (const dLng of [0, 0.002, 0.0051, 0.0099]) {
        const z = approximateZone({ lat: 4.7 + dLat, lng: -74.1 + dLng });
        centers.add(`${z.lat},${z.lng}`);
      }
    }
    expect(centers.size).toBe(1);
  });

  it('RF-9 (001): un límite de celda inexacto en flotante cae en la celda correcta', () => {
    // 4.35 * 100 = 434.99999999999994 en flotante: debe seguir en la celda 4,35–4,36.
    expect(approximateZone({ lat: 4.35, lng: -74.07 })).toEqual({ lat: 4.355, lng: -74.065 });
    expect(approximateZone({ lat: 1.15, lng: 2.3 })).toEqual({ lat: 1.155, lng: 2.305 });
  });

  it('RF-9 (001): el mismo punto da siempre la misma zona y la zona es estable (idempotente)', () => {
    const p = { lat: 6.2442, lng: -75.5812 };
    expect(approximateZone(p)).toEqual(approximateZone({ ...p }));
    expect(approximateZone(approximateZone(p))).toEqual(approximateZone(p));
  });

  it('RF-9 (001): el centro nunca sale del rango válido en los polos ni en el antimeridiano', () => {
    for (const [lat, lng] of [[90, 180], [-90, -180], [90, -180], [-90, 180]] as const) {
      const z = approximateZone({ lat, lng });
      expect(validateCoordinates(z.lat, z.lng).ok, `${lat},${lng}`).toBe(true);
    }
  });

  it('RF-9 (001): el centro dista menos de 0,01° del punto (≈ 1 km)', () => {
    const p = { lat: 4.7113, lng: -74.0721 };
    const z = approximateZone(p);
    expect(Math.abs(z.lat - p.lat)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(z.lng - p.lng)).toBeLessThanOrEqual(0.005);
  });
});

describe('shared/domain/location · displayLocation', () => {
  const point = { lat: 4.7113, lng: -74.0721 };

  it('RF-9 (001): la precisión por defecto es aproximada', () => {
    expect(DEFAULT_PRECISION).toBe('approximate');
  });

  it('RF-9 (001): con precisión aproximada muestra solo la zona, no el punto', () => {
    expect(displayLocation(point, 'approximate')).toEqual({ lat: 4.715, lng: -74.075, precision: 'approximate' });
  });

  it('RF-9 (001): con precisión exacta muestra el punto exacto', () => {
    expect(displayLocation(point, 'exact')).toEqual({ lat: 4.7113, lng: -74.0721, precision: 'exact' });
  });

  it('RF-9 (001): sin precisión indicada se aplica la aproximada', () => {
    expect(displayLocation(point)).toEqual(displayLocation(point, 'approximate'));
  });
});

describe('shared/domain/location · zoneKey', () => {
  it('RF-9 (001): puntos de la misma celda comparten clave y celdas distintas no', () => {
    expect(zoneKey({ lat: 4.7101, lng: -74.0701 })).toBe(zoneKey({ lat: 4.7199, lng: -74.0799 }));
    expect(zoneKey({ lat: 4.7101, lng: -74.0701 })).not.toBe(zoneKey({ lat: 4.7201, lng: -74.0701 }));
    expect(zoneKey({ lat: 4.7101, lng: -74.0701 })).not.toBe(zoneKey({ lat: 4.7101, lng: -74.0801 }));
  });

  it('RF-9 (001): el centro de una zona tiene la clave de su celda', () => {
    const p = { lat: 4.35, lng: -74.07 };
    expect(zoneKey(approximateZone(p))).toBe(zoneKey(p));
  });
});

describe('shared/domain/location · groupByLocation', () => {
  const at = (id: string, lat: number, lng: number, precision: 'approximate' | 'exact') => ({
    id,
    location: displayLocation({ lat, lng }, precision),
  });

  it('RF-9 (001): agrupa los ápices aproximados de la misma zona y conserva el orden', () => {
    const items = [
      at('a', 4.7101, -74.0701, 'approximate'),
      at('b', 6.2, -75.5, 'approximate'),
      at('c', 4.7199, -74.0799, 'approximate'),
    ];
    const { groups } = groupByLocation(items);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a', 'c'], ['b']]);
    expect(groups[0]).toMatchObject({ lat: 4.715, lng: -74.075 });
  });

  it('RF-9 (001): los exactos se agrupan solo con el mismo punto', () => {
    const { groups } = groupByLocation([
      at('a', 4.7101, -74.0701, 'exact'),
      at('b', 4.7101, -74.0701, 'exact'),
      at('c', 4.7102, -74.0701, 'exact'),
    ]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('RF-9 (001): un exacto no se mezcla con un aproximado aunque caigan en la misma celda', () => {
    const { groups } = groupByLocation([at('a', 4.715, -74.075, 'exact'), at('b', 4.7101, -74.0701, 'approximate')]);
    expect(groups).toHaveLength(2);
  });

  it('RF-9 (001): los ápices sin ubicación se omiten del mapa y se devuelven aparte', () => {
    const items = [at('a', 4.7, -74.0, 'approximate'), { id: 'x', location: null }];
    const result = groupByLocation(items);
    expect(result.groups.flatMap((g) => g.items.map((i) => i.id))).toEqual(['a']);
    expect(result.withoutLocation.map((i) => i.id)).toEqual(['x']);
  });

  it('RF-9 (001): sin ápices no hay grupos', () => {
    expect(groupByLocation([])).toEqual({ groups: [], withoutLocation: [] });
  });
});

describe('shared/domain/location · raisesLocation (spec 016)', () => {
  it('RF-1 (016) · 1.1: fijar una ubicación la sube, aunque sea aproximada', () => {
    expect(raisesLocation(null, { mode: 'set', precision: 'approximate' })).toBe(true);
    expect(raisesLocation('exact', { mode: 'set', precision: 'approximate' })).toBe(true);
  });

  it('RF-1 (016) · 1.1: volver exacta una ubicación aproximada la sube', () => {
    expect(raisesLocation('approximate', { mode: 'precision', precision: 'exact' })).toBe(true);
    expect(raisesLocation(null, { mode: 'precision', precision: 'exact' })).toBe(true);
  });

  it('RF-1 (016) · 1.2: quitar, conservar o volver aproximada no la sube', () => {
    expect(raisesLocation('exact', { mode: 'remove' })).toBe(false);
    expect(raisesLocation('exact', { mode: 'keep' })).toBe(false);
    expect(raisesLocation('exact', { mode: 'precision', precision: 'approximate' })).toBe(false);
    expect(raisesLocation('exact', { mode: 'precision', precision: 'exact' })).toBe(false);
  });
});
