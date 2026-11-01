// RF-21 (001) · Filtros de la lista en la URL (`?ejes=agua,energía&estado=idea`): recargar o compartir el
// enlace conserva la vista. Lo desconocido o repetido se ignora, no falla.
import { APICE_STATUSES, AXES, type ApiceStatus, type Axis } from '../../shared/domain/apice';
import { hasActiveFilters, NO_FILTERS, type ListFilters } from '../../shared/domain/discovery';

export function filtersFromSearch(search: string): ListFilters {
  const params = new URLSearchParams(search);
  const axes = (params.get('ejes') ?? '')
    .split(',')
    .filter((axis): axis is Axis => (AXES as readonly string[]).includes(axis));
  const status = params.get('estado');
  return {
    axes: [...new Set(axes)],
    status: (APICE_STATUSES as readonly string[]).includes(status ?? '') ? (status as ApiceStatus) : NO_FILTERS.status,
  };
}

/** `''` sin filtros; con filtros, la query con su `?`. */
export function filtersToSearch(filters: ListFilters): string {
  if (!hasActiveFilters(filters)) return '';
  const params = new URLSearchParams();
  if (filters.axes.length > 0) params.set('ejes', filters.axes.join(','));
  if (filters.status !== null) params.set('estado', filters.status);
  return `?${params.toString()}`;
}
