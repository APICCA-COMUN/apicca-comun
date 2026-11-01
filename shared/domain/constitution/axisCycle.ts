// RF-11 (005) · 11.2, D-T10 (005): eje que colorea el número de la sección en la posición `index` (desde 0), en el orden
// cíclico de los ejes. Solo decora: el número sigue en texto (RF-11 (005) · 11.3).
import { AXES, type Axis } from '../apice';

export function axisForIndex(index: number): Axis {
  return AXES[((index % AXES.length) + AXES.length) % AXES.length]!;
}
