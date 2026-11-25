// Presentación previa al lanzamiento (25-11-2026): la geometría pura del campo de muestra de la portada. Se comprueba que
// es siempre el mismo, que sus 14 zonas de siete celdas contienen los 20 Ápices sin repetir celda, que cada eje aparece en
// varios Ápices y que el Arco de cada eje (y el de muestra) se puede dibujar.
import { describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { buildArc } from '../../shared/domain/mapArcs';
import { CAMPO_R, apicesConEje, campoPresentacion } from './presentacionCampo';

/** Los centros de todas las celdas de las zonas, calculados con los 6 vértices de cada una en la trama. */
function centrosDeCeldas(trama: string): { x: number; y: number }[] {
  return trama
    .split('Z')
    .filter((celda) => celda !== '')
    .map((celda) => {
      const puntos = [...celda.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
      expect(puntos).toHaveLength(6);
      return {
        x: puntos.reduce((suma, p) => suma + p.x, 0) / 6,
        y: puntos.reduce((suma, p) => suma + p.y, 0) / 6,
      };
    });
}

const cerca = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) < 0.5;

describe('campoPresentacion', () => {
  it('es determinista: dos llamadas dan lo mismo', () => {
    expect(campoPresentacion()).toEqual(campoPresentacion());
  });

  it('tiene 14 zonas de siete celdas, cada una con su contorno', () => {
    const campo = campoPresentacion();
    expect(campo.zonas).toHaveLength(14);
    expect(new Set(campo.zonas.map((zona) => zona.key)).size).toBe(14);
    for (const zona of campo.zonas) expect(zona.contorno.split(' ').length).toBeGreaterThanOrEqual(12);
    expect(centrosDeCeldas(campo.trama)).toHaveLength(14 * 7);
  });

  it('tiene 20 Ápices con ids distintos, ejes y Etapa', () => {
    const campo = campoPresentacion();
    expect(campo.apices).toHaveLength(20);
    expect(new Set(campo.apices.map((apice) => apice.id)).size).toBe(20);
    for (const apice of campo.apices) {
      expect(apice.axes.length).toBeGreaterThan(0);
      expect(apice.status).toBeTruthy();
    }
  });

  it('ningún par de Ápices cae en la misma celda', () => {
    const { apices } = campoPresentacion();
    for (let i = 0; i < apices.length; i += 1) {
      for (let j = i + 1; j < apices.length; j += 1) {
        expect(cerca(apices[i]!, apices[j]!), `${apices[i]!.id} y ${apices[j]!.id}`).toBe(false);
      }
    }
  });

  it('cada Ápice cae dentro de alguna zona: su centro coincide con el centro de una celda', () => {
    const campo = campoPresentacion();
    const centros = centrosDeCeldas(campo.trama);
    for (const apice of campo.apices) {
      expect(
        centros.some((centro) => cerca(centro, apice)),
        apice.id,
      ).toBe(true);
    }
  });

  it('cada eje está en al menos 3 Ápices', () => {
    const campo = campoPresentacion();
    for (const eje of AXES) expect(apicesConEje(campo, eje).length, eje).toBeGreaterThanOrEqual(3);
  });

  it('`apicesConEje` devuelve solo Ápices con ese eje, en el orden del campo', () => {
    const campo = campoPresentacion();
    for (const eje of AXES) {
      const con = apicesConEje(campo, eje);
      expect(con.every((apice) => apice.axes.includes(eje))).toBe(true);
      expect(con.map((apice) => apice.id)).toEqual(campo.apices.filter((apice) => apice.axes.includes(eje)).map((apice) => apice.id));
    }
  });

  it('la Acción Común inicial usa ids existentes, sin repetir, y une ejes variados', () => {
    const campo = campoPresentacion();
    const ids = new Set(campo.apices.map((apice) => apice.id));
    expect(campo.arcoInicial.length).toBeGreaterThanOrEqual(3);
    expect(new Set(campo.arcoInicial).size).toBe(campo.arcoInicial.length);
    for (const id of campo.arcoInicial) expect(ids.has(id), id).toBe(true);
    const ejes = new Set(campo.arcoInicial.flatMap((id) => campo.apices.find((apice) => apice.id === id)!.axes));
    expect(ejes.size).toBeGreaterThanOrEqual(4);
  });

  it('el lienzo tiene ancho y alto positivos y contiene todos los centros y los contornos', () => {
    const campo = campoPresentacion();
    expect(campo.ancho).toBeGreaterThan(0);
    expect(campo.alto).toBeGreaterThan(0);
    for (const apice of campo.apices) {
      expect(apice.x - CAMPO_R).toBeGreaterThanOrEqual(0);
      expect(apice.x + CAMPO_R).toBeLessThanOrEqual(campo.ancho);
      expect(apice.y).toBeGreaterThan(0);
      expect(apice.y).toBeLessThan(campo.alto);
    }
    for (const centro of centrosDeCeldas(campo.trama)) {
      expect(centro.x).toBeGreaterThan(0);
      expect(centro.x).toBeLessThan(campo.ancho);
      expect(centro.y).toBeGreaterThan(0);
      expect(centro.y).toBeLessThan(campo.alto);
    }
    for (const zona of campo.zonas) {
      for (const par of zona.contorno.split(' ')) {
        const [x, y] = par.split(',').map(Number);
        expect(x!).toBeGreaterThanOrEqual(0);
        expect(x!).toBeLessThanOrEqual(campo.ancho);
        expect(y!).toBeGreaterThanOrEqual(0);
        expect(y!).toBeLessThanOrEqual(campo.alto);
      }
    }
  });

  it('`buildArc` da un Arco para cada eje y para la Acción Común inicial', () => {
    const campo = campoPresentacion();
    for (const eje of AXES) {
      const arco = buildArc(apicesConEje(campo, eje), CAMPO_R, { apices: campo.apices });
      expect(arco, eje).not.toBeNull();
      expect(arco!.segments.length, eje).toBeGreaterThan(0);
      expect(arco!.discs, eje).toHaveLength(arco!.stops.length);
    }
    const inicial = campo.arcoInicial.map((id) => campo.apices.find((apice) => apice.id === id)!);
    const arco = buildArc(inicial, CAMPO_R, { apices: campo.apices });
    expect(arco).not.toBeNull();
    expect(arco!.segments.length).toBeGreaterThan(0);
  });
});
