// RF-21 (001) · Filtros de la lista: uno o más ejes (basta que el ápice conecte alguno), un estado y quitarlos.
// RF-4 (002) · 4.2, RF-6 (002) · 6.1, 6.3: selector como bloque y botón como acción secundaria.
// RF-12 (003) · 12.3, D-23 (003), D-T18 (003): cada eje es un botón de ícono redondo de 44 px con `aria-pressed`.
import { APICE_STATUSES, AXES, type ApiceStatus } from '../../shared/domain/apice';
import { hasActiveFilters, type ListFilters } from '../../shared/domain/discovery';
import { AXIS_LABEL, AxisIcon } from './AxisIcon';
import './Filters.css';

interface Props {
  filters: ListFilters;
  onChange(filters: ListFilters): void;
}

export function Filters({ filters, onChange }: Props) {
  return (
    <form aria-label="Filtros" onSubmit={(event) => event.preventDefault()}>
      <fieldset>
        <legend>Ejes</legend>
        {AXES.map((axis) => (
          <button
            key={axis}
            type="button"
            className="block icon-button filter-axis"
            aria-label={AXIS_LABEL[axis]}
            title={AXIS_LABEL[axis]}
            aria-pressed={filters.axes.includes(axis)}
            onClick={() =>
              onChange({
                ...filters,
                axes: filters.axes.includes(axis) ? filters.axes.filter((a) => a !== axis) : [...filters.axes, axis],
              })
            }
          >
            <AxisIcon axis={axis} />
          </button>
        ))}
      </fieldset>
      <label>
        Estado
        <select
          className="block"
          value={filters.status ?? ''}
          onChange={(event) =>
            onChange({ ...filters, status: event.target.value === '' ? null : (event.target.value as ApiceStatus) })
          }
        >
          <option value="">Todos</option>
          {APICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      {hasActiveFilters(filters) && (
        <button type="button" className="block action-secondary" onClick={() => onChange({ axes: [], status: null })}>
          Quitar filtros
        </button>
      )}
    </form>
  );
}
