// T-44 (021) · RF-22 (021), RF-26 (021) · 26.2, D-T38 (021): los pasos del primer recorrido.
import { describe, expect, it } from 'vitest';
import { tourSteps } from './tour';

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
