// RF-21 (001) · Mensajes de la lista vacía: sin ápices (la persona inscrita puede crear el primero) o sin
// resultados para los filtros (se ofrece quitarlos).
// RF-6 (002) · 6.1, 6.3, 6.5; RF-4 (003) · 4.9: contenedor con «block block-empty» y controles con bloque y clase de acción («Crear el primero» es secundaria).
import type { EmptyState as EmptyStateKind } from '../../shared/domain/discovery';
import { Link } from '../app/router';

interface Props {
  kind: EmptyStateKind;
  /** Solo una persona inscrita puede crear ápices. */
  canCreate: boolean;
  onClearFilters(): void;
}

export function EmptyState({ kind, canCreate, onClearFilters }: Props) {
  if (kind === 'no-results') {
    return (
      <div className="block block-empty">
        <p>Ningún ápice cumple esos filtros.</p>
        <button type="button" className="block action-secondary" onClick={onClearFilters}>
          Quitar filtros
        </button>
      </div>
    );
  }
  return (
    <div className="block block-empty">
      <p>Todavía no hay ápices para mostrar.</p>
      {canCreate && (
        <Link href="/apices/nuevo" className="block action-secondary">
          Crear el primero
        </Link>
      )}
    </div>
  );
}
