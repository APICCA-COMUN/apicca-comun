// RF-12 (019) · 12.2, D-T6 (019): el botón de un eje con ícono y `aria-pressed`; lo comparten los filtros (solo ícono, 44 px cuadrado,
// RF-12 (003) · 12.3) y el selector de ejes del formulario (ícono con el nombre al lado).
import type { Axis } from '../../shared/domain/apice';
import { AXIS_LABEL, AxisIcon } from './AxisIcon';
import './AxisToggle.css';

interface AxisToggleProps {
  axis: Axis;
  pressed: boolean;
  onToggle(): void;
  /** Con el nombre visible al lado del ícono; sin esto, solo el ícono con el nombre como etiqueta accesible. */
  showLabel?: boolean;
}

export function AxisToggle({ axis, pressed, onToggle, showLabel = false }: AxisToggleProps) {
  if (showLabel) {
    return (
      <button type="button" className="block action-secondary axis-toggle" aria-pressed={pressed} onClick={onToggle}>
        <AxisIcon axis={axis} />
        {AXIS_LABEL[axis]}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="block icon-button filter-axis"
      aria-label={AXIS_LABEL[axis]}
      title={AXIS_LABEL[axis]}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      <AxisIcon axis={axis} />
    </button>
  );
}
