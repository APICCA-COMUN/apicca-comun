// RF-7 (003) · 7.4, 7.9, RF-11 (003) · 11.8, RF-13 (021) · 13.1 · D-T7 (003), D-T24 (021): el menú, la sección vigente y el
// destino de retorno son datos y reglas puras del dominio; se prueban sin navegador.
import { describe, expect, it } from 'vitest';
import { FACILITATION_MENU, MAIN_MENU, isCurrentSection, returnTarget } from './navigation';

describe('MAIN_MENU', () => {
  it('RF-13 (021) · 13.1, D-10 (021), RF-8 (009): el menú de juego trae el mapa, la documentación, la constitución y el foro con los nombres de D-10 (021)', () => {
    expect(MAIN_MENU.map((item) => [item.label, item.href])).toEqual([
      ['Jugar', '/'],
      ['Cómo se juega', '/documentacion'],
      ['Reglas', '/constitucion'],
      ['Plaza', '/foro'],
    ]);
  });

  it('RF-13 (021) · 13.1, D-T24 (021): ningún destino del menú pide sesión; lo que la pide va aparte (RF-13 (021) · 13.3)', () => {
    expect(MAIN_MENU.every((item) => item.requiresSession === false)).toBe(true);
  });
});

describe('FACILITATION_MENU', () => {
  it('RF-7 (003) · 7.9: el menú de Facilitación trae Invitaciones, Solicitudes y Cuentas', () => {
    expect(FACILITATION_MENU.map((item) => [item.label, item.href])).toEqual([
      ['Invitaciones', '/facilitacion/invitaciones'],
      ['Solicitudes', '/facilitacion/solicitudes'],
      ['Cuentas', '/facilitacion/cuentas'],
    ]);
  });

  it('RF-7 (003) · 7.9: marca solo su página vigente', () => {
    for (const current of FACILITATION_MENU) {
      const marked = FACILITATION_MENU.filter((item) => isCurrentSection(item.href, current.href));
      expect(marked.map((item) => item.href)).toEqual([current.href]);
    }
  });
});

describe('isCurrentSection', () => {
  it('RF-7 (003) · 7.4: marca la ruta exacta y las que cuelgan de ella por segmento completo', () => {
    expect(isCurrentSection('/documentacion', '/documentacion')).toBe(true);
    expect(isCurrentSection('/documentacion', '/documentacion/etica')).toBe(true);
    expect(isCurrentSection('/documentacion', '/documentacion/')).toBe(true);
  });

  it('RF-7 (003) · 7.4: no marca una ruta que solo comparte el comienzo del texto', () => {
    expect(isCurrentSection('/documentacion', '/documentacion-x')).toBe(false);
    expect(isCurrentSection('/documentacion', '/documentaciones/etica')).toBe(false);
  });

  it('RF-7 (003) · 7.4, D-T24 (021): por su ruta, las de ápices y el inicio no marcan ninguna sección; «Jugar» la marca el menú según la página', () => {
    for (const item of MAIN_MENU) {
      expect(isCurrentSection(item.href, '/apices/x'), item.label).toBe(false);
      expect(isCurrentSection(item.href, '/'), item.label).toBe(false);
    }
  });

  it('RF-7 (003) · 7.4: ignora la consulta y el fragmento de la ruta', () => {
    expect(isCurrentSection('/tablero', '/tablero?x=1')).toBe(true);
    expect(isCurrentSection('/tablero', '/tablero#arriba')).toBe(true);
  });
});

describe('returnTarget', () => {
  it('RF-11 (003) · 11.8: acepta solo /tablero, con o sin signo de interrogación inicial', () => {
    expect(returnTarget('?volver=%2Ftablero')).toBe('/tablero');
    expect(returnTarget('volver=/tablero')).toBe('/tablero');
    expect(returnTarget('?otro=1&volver=%2Ftablero')).toBe('/tablero');
  });

  it('RF-11 (003) · 11.8: rechaza redirecciones a otros sitios, rutas fuera de la lista, vacío y ausencia', () => {
    expect(returnTarget('?volver=%2F%2Fotro.sitio')).toBeNull();
    expect(returnTarget('?volver=https%3A%2F%2Fotro.sitio')).toBeNull();
    expect(returnTarget('?volver=%2Fapices%2Fx')).toBeNull();
    expect(returnTarget('?volver=')).toBeNull();
    expect(returnTarget('')).toBeNull();
    expect(returnTarget('?otro=1')).toBeNull();
  });

  it('RF-11 (003) · 11.8: rechaza variantes de /tablero que no son idénticas', () => {
    expect(returnTarget('?volver=%2Ftablero%2F')).toBeNull();
    expect(returnTarget('?volver=%2Ftablero%3Fx')).toBeNull();
    expect(returnTarget('?volver=%2FTablero')).toBeNull();
  });
});
