// RF-6 (001), RF-6 (002), RF-4 (002) · 4.2, RF-12 (019) · 12.2, D-T6 (019) · Selector de ejes: botones de ícono con `aria-pressed`
// dentro de un grupo, en el orden de los ejes del dominio.
import { AXES, type Axis } from '../../shared/domain/apice';
import { AXIS_LABEL } from './AxisIcon';
import { AxisToggle } from './AxisToggle';

export { AXIS_LABEL };

interface AxisPickerProps {
  value: readonly Axis[];
  onChange: (axes: Axis[]) => void;
  /** Id del texto que describe el error del grupo. */
  describedBy?: string | undefined;
}

export function AxisPicker({ value, onChange, describedBy }: AxisPickerProps) {
  const toggle = (axis: Axis): void => {
    onChange(AXES.filter((candidate) => (candidate === axis ? !value.includes(axis) : value.includes(candidate))));
  };
  return (
    <fieldset aria-describedby={describedBy} className="axis-picker">
      <legend>Ejes</legend>
      {AXES.map((axis) => (
        <AxisToggle key={axis} axis={axis} pressed={value.includes(axis)} onToggle={() => toggle(axis)} showLabel />
      ))}
    </fieldset>
  );
}
