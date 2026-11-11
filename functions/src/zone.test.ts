// Pruebas de la zona H3 (RF-5 (021) · 5.1, RF-5 (021) · 5.2, RNF-4 (021), D-T13 (021)) y de la celda madre del dominio
// contra la biblioteca (RF-7 (021) · 7.2, D-T16 (021)). Viven en `functions/` porque solo aquí está `h3-js`.
import { cellArea, cellToParent, getResolution, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { parentCell } from '../../shared/domain/hexmap';
import { ZONE_RESOLUTION } from '../../shared/domain/location';
import { publishedLocation, zoneOf } from './zone';

const EXACT = { lat: 4.3567891, lng: -74.1234567 };
const ZONE = { cell: '8766e08e4ffffff', lat: 4.367389, lng: -74.124852 };

/** Puntos repartidos por el globo, cada 15 grados, con los polos y el antimeridiano. */
const SAMPLE = Array.from({ length: 13 }, (_, i) => -90 + i * 15).flatMap((lat) =>
  Array.from({ length: 25 }, (_, j) => ({ lat, lng: -180 + j * 15 })),
);

/** Área máxima de la zona anterior: una celda de 0,01° por lado en el ecuador (RF-9 (001)). */
const OLD_ZONE_KM2 = (0.01 * 111.32) ** 2;

describe('zone · celda de un punto', () => {
  it('RF-5 (021) · 5.1: la zona de un punto es la celda H3 de resolución 7 que lo contiene, con su centro', () => {
    expect(ZONE_RESOLUTION).toBe(7);
    expect(zoneOf(EXACT)).toEqual(ZONE);
    expect(getResolution(zoneOf(EXACT).cell)).toBe(7);
    expect(zoneOf({ lat: 4.6, lng: -74.08 })).toEqual({ cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 });
    expect(zoneOf({ lat: -12.0464, lng: -77.0428 })).toEqual({ cell: '878e62c01ffffff', lat: -12.043621, lng: -77.054062 });
  });

  it('RF-5 (021) · 5.1: dos puntos de la misma celda comparten zona, y la zona de su centro es ella misma', () => {
    expect(zoneOf({ lat: 4.5981, lng: -74.076 })).toEqual(zoneOf({ lat: 4.6, lng: -74.08 }));
    const zone = zoneOf(EXACT);
    expect(zoneOf(zone)).toEqual(zone);
    expect(zoneOf({ lat: 4.6486, lng: -74.0628 }).cell).not.toBe(zoneOf({ lat: 4.6, lng: -74.08 }).cell);
  });

  it('RF-5 (021) · 5.1: los polos y el antimeridiano tienen zona', () => {
    for (const point of SAMPLE) {
      const zone = zoneOf(point);
      expect(zone.cell, JSON.stringify(point)).toMatch(/^87[0-9a-f]{13}$/);
      expect(zone.cell).toBe(latLngToCell(point.lat, point.lng, 7));
      expect(Math.abs(zone.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(zone.lng)).toBeLessThanOrEqual(180);
    }
  });
});

describe('zone · ubicación publicada', () => {
  it('RF-5 (021) · 5.2: con precisión aproximada se publica solo la zona y su centro, nunca el punto', () => {
    const published = publishedLocation(EXACT, 'approximate');
    expect(published).toEqual({ lat: ZONE.lat, lng: ZONE.lng, precision: 'approximate', zone: ZONE });
    expect(JSON.stringify(published)).not.toContain(String(EXACT.lat));
    expect(JSON.stringify(published)).not.toContain(String(EXACT.lng));
    expect(publishedLocation(EXACT)).toEqual(published);
  });

  it('RF-5 (021) · 5.2: con precisión exacta se publica el punto y, para el mapa, su zona', () => {
    expect(publishedLocation(EXACT, 'exact')).toEqual({ ...EXACT, precision: 'exact', zone: ZONE });
  });

  it('RNF-4 (021): la zona publicada nunca es más pequeña que la zona de 0,01° que había antes', () => {
    expect(OLD_ZONE_KM2).toBeCloseTo(1.239, 2);
    for (const point of SAMPLE) {
      expect(cellArea(zoneOf(point).cell, 'km2'), JSON.stringify(point)).toBeGreaterThan(OLD_ZONE_KM2);
    }
  });
});

describe('zone · celda madre del dominio', () => {
  it('RF-7 (021) · 7.2, D-T16 (021): la celda madre calculada por bits es la misma que da la biblioteca', () => {
    for (const point of SAMPLE) {
      const { cell } = zoneOf(point);
      for (let resolution = 0; resolution <= ZONE_RESOLUTION; resolution += 1) {
        expect(parentCell(cell, resolution), `${cell} → ${resolution}`).toBe(cellToParent(cell, resolution));
      }
    }
  });
});
