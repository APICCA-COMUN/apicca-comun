// RF-6 (001), RF-6 (002), RF-4 (002) · 4.2 · Selector de ejes: casillas dentro de un grupo, en el orden de los ejes del dominio.
import { AXES, type Axis } from '../../shared/domain/apice';
import { AXIS_LABEL, AxisBadge } from './AxisIcon';

export { AXIS_LABEL };

interface AxisPickerProps {
  value: readonly Axis[];
  onChange: (axes: Axis[]) => void;
  /** Id del texto que describe el error del grupo. */
  describedBy?: string | undefined;
}

export function AxisPicker({ value, onChange, describedBy }: AxisPickerProps) {
  const toggle = (axis: Axis, checked: boolean): void => {
    onChange(AXES.filter((candidate) => (candidate === axis ? checked : value.includes(candidate))));
  };
  return (
    <fieldset aria-describedby={describedBy}>
      <legend>Ejes</legend>
      {AXES.map((axis) => (
        <label key={axis}>
          <input type="checkbox" className="choice" checked={value.includes(axis)} onChange={(event) => toggle(axis, event.target.checked)} />
          <AxisBadge axis={axis} />
        </label>
      ))}
    </fieldset>
  );
}
