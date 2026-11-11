import { describe, expect, it } from 'vitest';
import { DEFAULT_PRECISION, raisesLocation, readLocation, readZone, validateCoordinates, ZONE_RESOLUTION } from './location';
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

describe('shared/domain/location · zona', () => {
  const zone = { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 };

  it('RF-9 (001): al indicar una ubicación la precisión es aproximada', () => {
    expect(DEFAULT_PRECISION).toBe('approximate');
  });

  it('RF-5 (021) · 5.2: la zona es una celda de resolución 7', () => {
    expect(ZONE_RESOLUTION).toBe(7);
  });

  it('RF-5 (021) · 5.2: lee la zona guardada, con su celda y su centro', () => {
    expect(readZone(zone)).toEqual(zone);
    expect(readZone({ ...zone, extra: 'x' })).toEqual(zone);
  });

  it('RF-5 (021) · 5.2: lo que no es una zona válida se lee como ausente', () => {
    for (const bad of [
      null,
      undefined,
      'x',
      {},
      { ...zone, cell: 87 },
      { ...zone, cell: '8766e092afffff' },
      { ...zone, cell: '8766E092AFFFFFF' },
      { ...zone, cell: 'punto:4.6,-74.08' },
      { ...zone, lat: 91 },
      { ...zone, lng: '-74' },
      { cell: zone.cell },
    ]) {
      expect(readZone(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('shared/domain/location · readLocation', () => {
  const zone = { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 };

  it('RF-5 (021) · 5.2: lee la ubicación publicada con su zona', () => {
    expect(readLocation({ lat: zone.lat, lng: zone.lng, precision: 'approximate', zone })).toEqual({
      lat: zone.lat,
      lng: zone.lng,
      precision: 'approximate',
      zone,
    });
    expect(readLocation({ lat: 4.6, lng: -74.08, precision: 'exact', zone })).toEqual({ lat: 4.6, lng: -74.08, precision: 'exact', zone });
  });

  it('RF-5 (021) · 5.4: una ubicación anterior al recálculo se lee sin zona', () => {
    expect(readLocation({ lat: 4.715, lng: -74.075, precision: 'approximate' })).toEqual({ lat: 4.715, lng: -74.075, precision: 'approximate' });
    expect(readLocation({ lat: 4.715, lng: -74.075, precision: 'approximate', zone: { cell: 'x' } })).toEqual({
      lat: 4.715,
      lng: -74.075,
      precision: 'approximate',
    });
  });

  it('RF-9 (001): sin coordenadas válidas no hay ubicación, y una precisión desconocida es aproximada', () => {
    expect(readLocation(null)).toBeNull();
    expect(readLocation({ lat: 91, lng: 0 })).toBeNull();
    expect(readLocation({ lat: 1, lng: 2, precision: 'casi' })).toEqual({ lat: 1, lng: 2, precision: 'approximate' });
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
