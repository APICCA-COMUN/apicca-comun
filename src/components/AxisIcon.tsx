// RF-4 (002) · 4.2, 4.5, D-T5 (002) · Ícono de un eje como SVG en línea: solo, con el nombre del eje como
// nombre accesible, o en una insignia con el nombre al lado. Sistema «APICCA · Mapa» (23-11-2026): es la losa del
// color del eje con su glifo en `glifo-sobre-eje` (`Glifo`). Con `x` e `y` va dentro de otro SVG.
import type { Axis } from '../../shared/domain/apice';
import { axisIdentity } from '../../shared/domain/identity';
import { Glifo } from './Glifo';
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
  x?: number;
  y?: number;
}

export function AxisIcon({ axis, labelled = false, size = 24, x, y }: AxisIconProps) {
  return <Glifo axis={axis} size={size} x={x} y={y} labelled={labelled} label={AXIS_LABEL[axis]} className={`axis-icon axis-icon--${axisIdentity(axis).key}`} />;
}

/** El ícono decorativo con el nombre del eje al lado, en minúscula como en el texto corrido y en `LeyendaEjes` (QA #19.1). */
export function AxisBadge({ axis }: { axis: Axis }) {
  return (
    <span className="axis-badge">
      <AxisIcon axis={axis} />
      {axis}
    </span>
  );
}
