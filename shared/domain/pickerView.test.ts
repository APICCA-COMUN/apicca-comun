// T-17 (024) · RF-12 (024), D-T15 (024): la vista con la que abre el selector de ubicación sin punto, según las zonas de los
// ápices que la persona ve. Solo recibe centros de zona, nunca puntos exactos.
import { describe, expect, it } from 'vitest';
import { pickerView, PICKER_CENTER_ZOOM } from './pickerView';

const bogota = { lat: 4.597156, lng: -74.08474 };
const chapinero = { lat: 4.649886, lng: -74.060244 };
const medellin = { lat: 6.243305, lng: -75.585547 };

describe('pickerView', () => {
  it('RF-12 (024): sin zonas abre como hoy, con la vista de siempre', () => {
    expect(pickerView([])).toEqual({ kind: 'default' });
  });

  it('RF-12 (024) · 12.1: con una sola zona abre centrado en ella, al zoom de una celda', () => {
    expect(pickerView([bogota])).toEqual({ kind: 'center', point: bogota, zoom: PICKER_CENTER_ZOOM });
    expect(PICKER_CENTER_ZOOM).toBeGreaterThanOrEqual(12);
    expect(PICKER_CENTER_ZOOM).toBeLessThanOrEqual(14);
  });

  it('RF-12 (024) · 12.1: varias zonas iguales cuentan como una sola', () => {
    expect(pickerView([bogota, { ...bogota }, bogota])).toEqual({ kind: 'center', point: bogota, zoom: PICKER_CENTER_ZOOM });
  });

  it('RF-12 (024) · 12.1: varias zonas dispersas dan la caja que las envuelve', () => {
    expect(pickerView([bogota, medellin, chapinero])).toEqual({
      kind: 'bounds',
      south: bogota.lat,
      north: medellin.lat,
      west: medellin.lng,
      east: chapinero.lng,
    });
  });

  it('RF-12 (024) · 12.1: dos zonas distintas dan una caja aunque estén muy cerca', () => {
    const view = pickerView([bogota, chapinero]);
    expect(view.kind).toBe('bounds');
  });

  it('RF-12 (024) · 12.1: a ambos lados del antimeridiano la caja es angosta, no da la vuelta al mundo', () => {
    const view = pickerView([
      { lat: -17.7, lng: 179.5 },
      { lat: -16.9, lng: -179.5 },
    ]);
    expect(view.kind).toBe('bounds');
    if (view.kind !== 'bounds') return;
    expect(view.east - view.west).toBeCloseTo(1, 6);
    expect(view.west).toBeCloseTo(179.5, 6);
    expect(view.south).toBe(-17.7);
    expect(view.north).toBe(-16.9);
  });

  it('RF-12 (024) · 12.1: cerca de los polos conserva latitudes y longitudes sin salirse de los límites', () => {
    const view = pickerView([
      { lat: 89.9, lng: 10 },
      { lat: 89.5, lng: -170 },
    ]);
    expect(view.kind).toBe('bounds');
    if (view.kind !== 'bounds') return;
    expect(view.north).toBe(89.9);
    expect(view.south).toBe(89.5);
    expect(view.north).toBeLessThanOrEqual(90);
    expect(view.west).toBeGreaterThanOrEqual(-180);
    expect(view.west).toBeLessThan(180);
  });

  it('RF-12 (024) · 12.1: la misma entrada en otro orden da la misma caja', () => {
    const zones = [bogota, medellin, chapinero, { lat: -17.7, lng: 179.5 }, { lat: -16.9, lng: -179.5 }];
    const straight = pickerView(zones);
    expect(pickerView([...zones].reverse())).toEqual(straight);
    expect(pickerView([zones[3]!, zones[0]!, zones[4]!, zones[2]!, zones[1]!])).toEqual(straight);
    const across = [{ lat: 0, lng: 179 }, { lat: 1, lng: -179 }];
    expect(pickerView([...across].reverse())).toEqual(pickerView(across));
  });

  it('RF-12 (024) · 12.1: solo lee latitud y longitud, nunca otros campos del punto', () => {
    const exactish = { ...bogota, precision: 'exact', exact: true } as unknown as { lat: number; lng: number };
    expect(pickerView([exactish])).toEqual({ kind: 'center', point: bogota, zoom: PICKER_CENTER_ZOOM });
  });
});
