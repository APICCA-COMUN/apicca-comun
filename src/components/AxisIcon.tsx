// RF-4 (002) · 4.2, 4.5, D-T5 (002) · Ícono de un eje como SVG en línea: solo, con el nombre del eje como
// nombre accesible, o en una insignia con el nombre al lado. El trazo toma `currentColor`, así sigue
// visible con colores forzados (AxisIcon.css).
import type { Axis } from '../../shared/domain/apice';
import { AXIS_ICONS, axisIdentity } from '../../shared/domain/identity';
import './AxisIcon.css';

/** Nombre de cada eje como se muestra: con mayúscula inicial. */
export const AXIS_LABEL: Record<Axis, string> = {
  agua: 'Agua',
  alimento: 'Alimento',
  cobijo: 'Cobijo',
  energía: 'Energía',
  comunicación: 'Comunicación',
};

interface AxisIconProps {
  axis: Axis;
  /** Con nombre accesible propio, cuando el nombre no se muestra al lado. */
  labelled?: boolean;
  size?: number;
}

export function AxisIcon({ axis, labelled = false, size = 24 }: AxisIconProps) {
  const { key } = axisIdentity(axis);
  const icon = AXIS_ICONS[key];
  const a11y = labelled ? { role: 'img', 'aria-label': AXIS_LABEL[axis] } : { 'aria-hidden': true };
  return (
    <svg className={`axis-icon axis-icon--${key}`} viewBox={icon.viewBox} width={size} height={size} focusable="false" {...a11y}>
      <path d={icon.d} fillRule="evenodd" />
    </svg>
  );
}

/** El ícono decorativo con el nombre del eje al lado. */
export function AxisBadge({ axis }: { axis: Axis }) {
  return (
    <span className="axis-badge">
      <AxisIcon axis={axis} />
      {AXIS_LABEL[axis]}
    </span>
  );
}
