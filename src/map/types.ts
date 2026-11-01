// RF-21 (001), RF-8 (002) · 8.3, 8.4 · Punto que el mapa pinta. Las reglas (zona, agrupación, tope) las calcula
// el dominio; el mapa solo recibe puntos ya resueltos.
import type { Axis } from '../../shared/domain/apice';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Nombre del punto; el nombre accesible del pin le suma los ejes. */
  label: string;
  /** Ejes que muestra el pin. */
  axes: readonly Axis[];
}
