// RF-8 (002) · 8.1, 8.2, 8.5, 8.6, D-T8 (002), D-T9 (002), D-T20 (002): `src/map/pin.css` tinta solo el panel
// de teselas con `--map-tint` (sin copiar sus valores), deja el fondo del tema detrás, pinta el pin y su
// foco con tokens y vuelve a los colores del sistema con colores forzados.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_TINT } from '../../shared/domain/identity/tokens';

const css = readFileSync(resolve(import.meta.dirname, '../../src/map/pin.css'), 'utf8');
const forced = css.slice(css.search(/@media\s*\(\s*forced-colors\s*:\s*active\s*\)/));

/** Las declaraciones del primer bloque cuyo selector contiene `selector`, fuera de forced-colors. */
function rule(selector: string, source = css): string {
  const at = source.indexOf(`${selector} {`) >= 0 ? source.indexOf(`${selector} {`) : source.indexOf(`${selector},`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', at);
  return source.slice(open + 1, source.indexOf('}', open));
}

describe('hoja del mapa', () => {
  it('RF-8 (002): la cabecera cita RF-8 (002) y ya no describe un pin pixelado', () => {
    const header = css.slice(0, css.indexOf('*/'));
    expect(header).toContain('RF-8 (002)');
    expect(header.toLowerCase()).not.toContain('pixelado');
  });

  it('RF-8 (002) · 8.1, 8.2, D-T8 (002): el panel de teselas usa var(--map-tint) y ningún valor de MAP_TINT está escrito a mano', () => {
    expect(rule('.leaflet-tile-pane')).toMatch(/filter:\s*var\(--map-tint\)/);
    for (const value of Object.values(MAP_TINT)) expect(css).not.toContain(value);
    expect(css).not.toMatch(/invert\(|hue-rotate\(|sepia\(/);
  });

  it('RF-8 (002) · 8.1, D-T8 (002): el contenedor del mapa tiene el fondo del tema', () => {
    expect(rule('.leaflet-container')).toMatch(/background(-color)?:\s*var\(--background\)/);
  });

  it('RF-8 (002) · 8.3, 8.5, D-T9 (002): el pin es charcoal y su foco usa el token focus y sube de z-index', () => {
    expect(rule('.apicca-pin')).toMatch(/background(-color)?:\s*var\(--charcoal\)/);
    const focus = rule('.apicca-pin:focus-visible');
    expect(focus).toMatch(/outline:[^;]*var\(--focus\)/);
    expect(focus).toMatch(/z-index:\s*\d+\s*!important/);
  });

  it('RF-8 (002) · 8.6, D-T20 (002): la atribución y los controles toman surface y text', () => {
    expect(rule('.leaflet-container .leaflet-control-attribution')).toMatch(/background(-color)?:\s*var\(--surface\)/);
    expect(rule('.leaflet-container .leaflet-control-attribution')).toMatch(/color:\s*var\(--text\)/);
    expect(rule('.leaflet-bar a')).toMatch(/background(-color)?:\s*var\(--surface\)/);
    expect(rule('.leaflet-popup-content-wrapper')).toMatch(/background(-color)?:\s*var\(--surface\)/);
  });

  it('RNF-1 (002), RF-8 (002) · 8.5: con colores forzados no hay tintado y el pin usa CanvasText y Canvas', () => {
    expect(forced).not.toBe('');
    expect(rule('.leaflet-tile-pane', forced)).toMatch(/filter:\s*none/);
    const pin = rule('.apicca-pin', forced);
    expect(pin).toMatch(/background(-color)?:\s*Canvas\b/);
    expect(pin).toMatch(/border-color:\s*CanvasText/);
    expect(forced).toMatch(/\.apicca-pin \.axis-icon[^{]*\{[^}]*CanvasText/);
  });
});
