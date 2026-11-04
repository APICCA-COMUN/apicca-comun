// RF-21 (001) · Mensajes de la lista vacía: sin ápices (la persona inscrita puede crear el primero) o sin
// resultados para los filtros (se ofrece quitarlos).
// RF-6 (002) · 6.1, 6.3, 6.5; RF-4 (003) · 4.9: «no-results» es un «block block-empty» con un control de bloque y acción secundaria.
// RF-19 (019) · 19.1 a 19.3: «no-apices» es el terreno de partida, con «Pide tu inscripción» o «Propón el primer ápice».
import type { EmptyState as EmptyStateKind } from '../../shared/domain/discovery';
import { StartingTerrain } from './StartingTerrain';

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
  // RF-19 (019) · 19.2, 19.3: sin ápices, el terreno de partida nombra el vacío y ofrece la siguiente acción.
  return (
    <StartingTerrain
      phrase="Aún no hay ápices en el terreno."
      action={canCreate ? { label: 'Propón el primer ápice', href: '/apices/nuevo' } : { label: 'Pide tu inscripción', href: '/solicitar' }}
    />
  );
}
