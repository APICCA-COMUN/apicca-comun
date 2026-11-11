// RF-23 (021) · 23.1, 23.2, 23.4, RNF-6 (021), D-T39 (021): el boceto del visitante. Vive en `sessionStorage` de este
// navegador, para que sobreviva a una recarga, y nunca se envía al servidor.
import { APICE_STATUSES, AXES, INITIAL_APICE_STATUS, type ApiceStatus, type Axis } from '../../shared/domain/apice';
import type { ListedApice } from '../data/apices';

export interface Sketch {
  axes: Axis[];
  status: ApiceStatus;
}

export const EMPTY_SKETCH: Sketch = { axes: [], status: INITIAL_APICE_STATUS };

/** Id del edificio del boceto en el mapa; ningún documento lo usa. */
export const SKETCH_ID = '__boceto__';

const KEY = 'apicca:boceto';

export function readSketch(): Sketch {
  let value: unknown;
  try {
    const text = window.sessionStorage.getItem(KEY);
    if (text === null) return EMPTY_SKETCH;
    value = JSON.parse(text);
  } catch {
    return EMPTY_SKETCH;
  }
  if (typeof value !== 'object' || value === null) return EMPTY_SKETCH;
  const record = value as Record<string, unknown>;
  const status = APICE_STATUSES.find((candidate) => candidate === record['status']);
  if (!Array.isArray(record['axes']) || status === undefined) return EMPTY_SKETCH;
  const chosen = record['axes'] as unknown[];
  return { axes: AXES.filter((axis) => chosen.includes(axis)), status };
}

export function saveSketch(sketch: Sketch): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(sketch));
  } catch {
    // Almacenamiento bloqueado: el boceto dura lo que dure la página.
  }
}

/** El edificio del boceto, en el terreno sin ubicar; `null` mientras no tiene ejes. */
export function sketchItem(sketch: Sketch): ListedApice | null {
  if (sketch.axes.length === 0) return null;
  return {
    id: SKETCH_ID,
    name: 'Boceto',
    description: '',
    axes: sketch.axes,
    status: sketch.status,
    updatedAt: { seconds: 0, nanoseconds: 0 },
    needs: '',
    location: null,
  };
}
