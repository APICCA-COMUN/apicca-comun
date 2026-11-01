// RF-8 (002) · 8.3, 8.4, D-T5 (002), D-T9 (002) · HTML del pin para `L.divIcon`: los íconos de los ejes, de 12 px,
// en el orden de AXES. Las medidas y el nombre accesible los calcula el dominio (`pinSize`, `pinAccessibleName`);
// los colores los pone `pin.css` con las mismas clases que `AxisIcon`.
import type { Axis } from '../../shared/domain/apice';
import { AXIS_ICONS, axisIdentity, pinSize, sortAxes } from '../../shared/domain/identity';

const ICON = 12;

/** Los íconos del pin, decorativos: el nombre accesible lo lleva el propio pin. */
export function pinHtml(axes: readonly Axis[]): string {
  return sortAxes(axes)
    .map((axis) => {
      const { key } = axisIdentity(axis);
      const icon = AXIS_ICONS[key];
      return `<svg class="axis-icon axis-icon--${key}" viewBox="${icon.viewBox}" width="${ICON}" height="${ICON}" focusable="false" aria-hidden="true"><path d="${icon.d}" fill-rule="evenodd"/></svg>`;
    })
    .join('');
}

/** Opciones de `L.divIcon`: clase propia, medidas de `pinSize` y ancla abajo al centro. */
export function pinIconOptions(axes: readonly Axis[]) {
  const { width, height } = pinSize(axes);
  return {
    className: 'apicca-pin',
    html: pinHtml(axes),
    iconSize: [width, height] as [number, number],
    iconAnchor: [width / 2, height] as [number, number],
  };
}
