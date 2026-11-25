// T-44 (021) · RF-22 (021), RF-26 (021) · 26.2, D-T38 (021): los pasos del primer recorrido.
import { describe, expect, it } from 'vitest';
import { tourSteps } from './tour';

describe('tourSteps', () => {
  it('RF-22 (021) · 22.1: con Ápices y Acciones Comunes son tres pasos, en orden: mirar un Ápice, mirar una Acción Común y prototipar', () => {
    expect(tourSteps({ apices: 4, paths: 1, signedIn: true }).map((step) => step.key)).toEqual(['apice', 'camino', 'construir']);
  });

  it('RF-22 (021) · 22.3: sin Acciones Comunes omite ese paso; sin Ápices, también el de mirar un Ápice', () => {
    expect(tourSteps({ apices: 2, paths: 0, signedIn: true }).map((step) => step.key)).toEqual(['apice', 'construir']);
    expect(tourSteps({ apices: 0, paths: 0, signedIn: false }).map((step) => step.key)).toEqual(['construir']);
  });

  it('RF-26 (021) · 26.2: sin sesión, el paso de prototipar dice antes que hace falta unirse', () => {
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
    expect(text).toContain('Prototipar un Ápice');
    expect(text).toContain('Conectar');
  });

  it('usa el vocabulario de APICCA: Ápice, Acción Común y Conectar, sin juego, edificio, manzana, camino ni construir', () => {
    for (const signedIn of [true, false]) {
      for (const step of tourSteps({ apices: 3, paths: 2, signedIn })) {
        expect(`${step.title} ${step.text}`, step.key).not.toMatch(/juego|jugar|edificio|manzana|camino|constru|plaza|puntaje|monedas/i);
      }
    }
    const titles = tourSteps({ apices: 3, paths: 2, signedIn: true }).map((step) => step.title);
    expect(titles).toEqual(['Mira un Ápice', 'Mira una Acción Común', 'Prototipa y conecta']);
  });

  it('E3 · Celda: el paso de la Acción Común habla del arco, no de una fila de celdas (la cadena `ruta` salió)', () => {
    const paso = tourSteps({ apices: 3, paths: 2, signedIn: false }).find((step) => step.key === 'camino')!;
    expect(paso.text).toBe('Cada arco con nombre es una Acción Común que une Ápices. El mapa se acercó a una: elige su nombre para ver quién participa.');
    expect(paso.text).not.toMatch(/fila de celdas/i);
  });
});
