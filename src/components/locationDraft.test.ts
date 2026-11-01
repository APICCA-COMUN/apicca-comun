import { describe, expect, it } from 'vitest';
import { describeLocation } from './locationText';
import { KEEP_LOCATION, resolveLocationDraft, restoreLocationDraft, typeCoordinates } from './locationDraft';

describe('resolveLocationDraft', () => {
  it('RF-9 (001): conservar y quitar no necesitan coordenadas', () => {
    expect(resolveLocationDraft({ mode: 'keep' })).toEqual({ ok: true, value: { mode: 'keep' } });
    expect(resolveLocationDraft({ mode: 'remove' })).toEqual({ ok: true, value: { mode: 'remove' } });
  });

  it('RF-9 (001): cambiar solo la precisión no pide coordenadas', () => {
    expect(resolveLocationDraft({ mode: 'precision', precision: 'exact' })).toEqual({
      ok: true,
      value: { mode: 'precision', precision: 'exact' },
    });
  });

  it('RF-9 (001): coordenadas válidas se envían como números, aceptando coma decimal', () => {
    expect(resolveLocationDraft({ mode: 'set', lat: '-33,45', lng: ' -70.66 ', precision: 'approximate' })).toEqual({
      ok: true,
      value: { mode: 'set', lat: -33.45, lng: -70.66, precision: 'approximate' },
    });
  });

  it('RF-9 (001): coordenadas fuera de rango, vacías o con texto se rechazan con coordinates-invalid', () => {
    for (const [lat, lng] of [['91', '0'], ['0', '-181'], ['', '10'], ['10', ''], ['abc', '10'], ['1e', '3']]) {
      const result = resolveLocationDraft({ mode: 'set', lat: lat ?? '', lng: lng ?? '', precision: 'approximate' });
      expect(result).toEqual({ ok: false, code: 'coordinates-invalid' });
    }
  });
});

describe('typeCoordinates', () => {
  it('RF-9 (001): escribir en un campo abre un borrador con la precisión aproximada por defecto', () => {
    expect(typeCoordinates(KEEP_LOCATION, { lat: '-33' })).toEqual({ mode: 'set', lat: '-33', lng: '', precision: 'approximate' });
  });

  it('RF-9 (001): al vaciar ambos campos se vuelve a conservar lo guardado', () => {
    const draft = { mode: 'set', lat: '1', lng: '', precision: 'approximate' } as const;
    expect(typeCoordinates(draft, { lat: '' })).toEqual(KEEP_LOCATION);
  });

  it('RF-9 (001): conserva la precisión elegida al seguir escribiendo', () => {
    const draft = { mode: 'set', lat: '1', lng: '2', precision: 'exact' } as const;
    expect(typeCoordinates(draft, { lng: '3' })).toEqual({ mode: 'set', lat: '1', lng: '3', precision: 'exact' });
  });
});

describe('restoreLocationDraft', () => {
  it('RF-9 (001): un borrador guardado se recupera y uno dañado vuelve a conservar', () => {
    const draft = { mode: 'set', lat: '1', lng: '2', precision: 'exact' };
    expect(restoreLocationDraft(draft)).toEqual(draft);
    expect(restoreLocationDraft({ mode: 'volar' })).toEqual(KEEP_LOCATION);
    expect(restoreLocationDraft('x')).toEqual(KEEP_LOCATION);
    expect(restoreLocationDraft({ mode: 'set', lat: 1, lng: 2 })).toEqual(KEEP_LOCATION);
  });
});

describe('describeLocation', () => {
  it('RF-22 (001): sin ubicación dice «Sin ubicación»', () => {
    expect(describeLocation(null)).toBe('Sin ubicación');
    expect(describeLocation(undefined)).toBe('Sin ubicación');
  });

  it('RF-9 (001): la aproximada se dice zona de ≈ 1 km y la exacta, punto', () => {
    expect(describeLocation({ lat: -33.455, lng: -70.665, precision: 'approximate' })).toBe(
      'Zona de ≈ 1 km alrededor de -33.455, -70.665',
    );
    expect(describeLocation({ lat: -33.4512, lng: -70.6634, precision: 'exact' })).toBe('Punto exacto: -33.4512, -70.6634');
  });
});
