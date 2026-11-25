// RF-11 (021) · 11.1, excepción temporal (la presentación previa al lanzamiento, `Presentacion.tsx`).
// Presentación previa al lanzamiento (25-11-2026, Propuesta del asistente): el campo de muestra de la portada. Es un mapa
// en miniatura hecho a mano, con la misma gramática que el mapa real («E3 · Celda»): zonas de siete celdas de punta plana
// con su borde, la trama solo dentro de las zonas y algunos Ápices de muestra con su superficie de patrón. No son datos
// reales: la página lo dice al lado. Puro: sin React ni DOM; todo en unidades del `viewBox`, con el eje y hacia abajo.
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import type { ArcPoint } from '../../shared/domain/mapArcs';

/** Radio de la celda (del centro a un vértice), en unidades del `viewBox`. */
export const CAMPO_R = 26;
/** Aire alrededor de las zonas, en unidades del `viewBox`. */
const MARGEN = 8;

const S3 = Math.sqrt(3);

/** Los seis vecinos de una celda, en coordenadas axiales (q, r) de punta plana. */
const VECINOS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** Los dos pasos que llevan del centro de una zona de siete celdas al de la vecina (la red de apertura 7, como H3). */
const PASO_U = [2, 1] as const;
const PASO_V = [-1, 3] as const;

/**
 * Las zonas del campo, como índices de la red de zonas: una mancha irregular con dos zonas sueltas, como un territorio
 * real. El orden es el de aparición (de dentro hacia fuera).
 */
const ZONAS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [-1, 1],
  [1, -1],
  [-1, 0],
  [0, -1],
  [2, -1],
  [1, 1],
  [-2, 1],
  [2, 0],
  [-1, 2],
  [3, -2],
  [-2, 2],
];

interface ApiceDeMuestra {
  /** Índice en `ZONAS`. */
  zona: number;
  /** 0 es el centro de la zona; de 1 a 6, sus vecinos en el orden de `VECINOS`. */
  celda: number;
  axes: Axis[];
  status: ApiceStatus;
}

/** Los Ápices de muestra: cada eje aparece en varios, repartidos por el campo, para que su Arco lo cruce. */
const APICES: readonly ApiceDeMuestra[] = [
  { zona: 0, celda: 0, axes: ['agua', 'alimento'], status: 'en marcha' },
  { zona: 0, celda: 4, axes: ['comunicación'], status: 'idea' },
  { zona: 1, celda: 2, axes: ['energía'], status: 'prototipo' },
  { zona: 1, celda: 6, axes: ['agua'], status: 'idea' },
  { zona: 2, celda: 1, axes: ['cobijo', 'energía'], status: 'en marcha' },
  { zona: 2, celda: 5, axes: ['alimento'], status: 'prototipo' },
  { zona: 3, celda: 3, axes: ['agua', 'comunicación'], status: 'prototipo' },
  { zona: 4, celda: 0, axes: ['cobijo'], status: 'idea' },
  { zona: 4, celda: 3, axes: ['alimento', 'comunicación'], status: 'en marcha' },
  { zona: 5, celda: 6, axes: ['energía'], status: 'idea' },
  { zona: 5, celda: 2, axes: ['cobijo', 'agua'], status: 'prototipo' },
  { zona: 6, celda: 4, axes: ['alimento'], status: 'idea' },
  { zona: 7, celda: 0, axes: ['comunicación', 'energía'], status: 'prototipo' },
  { zona: 8, celda: 3, axes: ['agua'], status: 'en marcha' },
  { zona: 8, celda: 1, axes: ['cobijo'], status: 'prototipo' },
  { zona: 9, celda: 0, axes: ['alimento', 'energía'], status: 'idea' },
  { zona: 10, celda: 5, axes: ['comunicación'], status: 'en marcha' },
  { zona: 11, celda: 2, axes: ['cobijo', 'alimento'], status: 'idea' },
  { zona: 12, celda: 0, axes: ['agua', 'energía'], status: 'idea' },
  { zona: 13, celda: 1, axes: ['comunicación', 'cobijo'], status: 'prototipo' },
];

/** La Acción Común de muestra que se ve antes de tocar un eje: une Ápices de ejes distintos, de un lado al otro. */
const ARCO_INICIAL: readonly number[] = [9, 6, 0, 2, 12];

export interface CampoApice extends ArcPoint {
  id: string;
  axes: Axis[];
  status: ApiceStatus;
  /** Orden de aparición, de dentro hacia fuera (para escalonar la entrada). */
  orden: number;
}

export interface CampoZona {
  key: string;
  /** El contorno de las siete celdas (`points` de un `<polygon>`). */
  contorno: string;
  orden: number;
}

export interface Campo {
  ancho: number;
  alto: number;
  /** Las celdas vacías de todas las zonas, como un solo `d`. */
  trama: string;
  zonas: CampoZona[];
  apices: CampoApice[];
  /** Los ids de la Acción Común de muestra, en orden. */
  arcoInicial: string[];
}

const f1 = (value: number): string => (Math.round(value * 10) / 10).toString();

/** Centro de la celda axial (q, r), sin desplazar. */
function centro(q: number, r: number): ArcPoint {
  return { x: CAMPO_R * 1.5 * q, y: CAMPO_R * S3 * (r + q / 2) };
}

function vertices(c: ArcPoint): ArcPoint[] {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = (Math.PI / 3) * k;
    return { x: c.x + CAMPO_R * Math.cos(angle), y: c.y + CAMPO_R * Math.sin(angle) };
  });
}

/** Las siete celdas axiales de la zona `[i, j]`: su centro y los seis vecinos. */
function celdasDeZona([i, j]: readonly [number, number]): [number, number][] {
  const q = i * PASO_U[0] + j * PASO_V[0];
  const r = i * PASO_U[1] + j * PASO_V[1];
  return [[q, r], ...VECINOS.map(([dq, dr]): [number, number] => [q + dq, r + dr])];
}

/** El borde exterior de un grupo de celdas: las aristas que no comparten, encadenadas en un solo polígono. */
function contornoDe(celdas: readonly ArcPoint[]): ArcPoint[] {
  const clave = (p: ArcPoint): string => `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;
  const aristas = new Map<string, { a: ArcPoint; b: ArcPoint; n: number }>();
  for (const c of celdas) {
    const vs = vertices(c);
    for (let k = 0; k < 6; k += 1) {
      const a = vs[k]!;
      const b = vs[(k + 1) % 6]!;
      const key = [clave(a), clave(b)].sort().join('|');
      const actual = aristas.get(key);
      if (actual) actual.n += 1;
      else aristas.set(key, { a, b, n: 1 });
    }
  }
  const borde = [...aristas.values()].filter((e) => e.n === 1);
  const siguiente = new Map<string, ArcPoint>();
  for (const { a, b } of borde) siguiente.set(clave(a), b);
  const inicio = borde[0]!.a;
  const puntos: ArcPoint[] = [inicio];
  let actual = siguiente.get(clave(inicio))!;
  while (clave(actual) !== clave(inicio) && puntos.length <= borde.length) {
    puntos.push(actual);
    actual = siguiente.get(clave(actual))!;
  }
  return puntos;
}

/** El campo de muestra de la portada, ya desplazado para que empiece en (MARGEN, MARGEN). Siempre el mismo. */
export function campoPresentacion(): Campo {
  const zonas = ZONAS.map((zona) => celdasDeZona(zona).map(([q, r]) => centro(q, r)));
  const todas = zonas.flat();
  const minX = Math.min(...todas.map((c) => c.x)) - CAMPO_R;
  const maxX = Math.max(...todas.map((c) => c.x)) + CAMPO_R;
  const minY = Math.min(...todas.map((c) => c.y)) - (CAMPO_R * S3) / 2;
  const maxY = Math.max(...todas.map((c) => c.y)) + (CAMPO_R * S3) / 2;
  const dx = MARGEN - minX;
  const dy = MARGEN - minY;
  const mover = (p: ArcPoint): ArcPoint => ({ x: p.x + dx, y: p.y + dy });

  const trama = todas
    .map((c) => {
      const [first, ...rest] = vertices(mover(c));
      return `M${f1(first!.x)} ${f1(first!.y)}${rest.map((v) => `L${f1(v.x)} ${f1(v.y)}`).join('')}Z`;
    })
    .join('');

  const apices: CampoApice[] = APICES.map((apice, index) => {
    const c = mover(zonas[apice.zona]![apice.celda]!);
    return { id: `muestra-${index}`, x: c.x, y: c.y, axes: apice.axes, status: apice.status, orden: apice.zona };
  });

  return {
    ancho: Math.ceil(maxX - minX + MARGEN * 2),
    alto: Math.ceil(maxY - minY + MARGEN * 2),
    trama,
    zonas: zonas.map((celdas, index) => ({
      key: `zona-${index}`,
      contorno: contornoDe(celdas.map(mover))
        .map((p) => `${f1(p.x)},${f1(p.y)}`)
        .join(' '),
      orden: index,
    })),
    apices,
    arcoInicial: ARCO_INICIAL.map((index) => `muestra-${index}`),
  };
}

/** Los Ápices de muestra que tienen `eje`, en el orden del campo. */
export function apicesConEje(campo: Campo, eje: Axis): CampoApice[] {
  return campo.apices.filter((apice) => apice.axes.includes(eje));
}
