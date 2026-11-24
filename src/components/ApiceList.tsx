// RF-21 (001), RF-6 (002) · Lista de ápices en tandas de 24 por cursor, de la más reciente a la más antigua. Se pide más con
// un botón, no con desplazamiento infinito. El mensaje de lista vacía lo decide quien la usa.
// RF-6 (019) · 6.2, D-T17 (019): la carga, el cursor y los parches viven en `useApiceListing`; la lista solo presenta.
// Mientras carga no pinta nada: el aviso de carga lo da la página (RF-7 (019) · 7.3).
// RF-19 (021) · 19.5: con `selection`, cada tarjeta lleva la casilla «Sumar a la Acción Común».
// Sistema «APICCA · Mapa»: `ApiceRows` es la misma lista en filas cortas, la del panel de Inicio.
import type { ReactNode } from 'react';
import type { EmptyState } from '../../shared/domain/discovery';
import type { ApiceListing } from '../app/useApiceListing';
import { ApiceCard, ApiceRow, type ApiceCardData } from './ApiceCard';

interface Props {
  listing: ApiceListing;
  /** Qué mostrar si no hay ningún ápice. */
  empty(state: EmptyState): ReactNode;
  /** Mientras se conecta una Acción Común: lo elegido y cómo sumar o quitar. */
  selection?: { chosen: readonly string[]; onToggle(id: string): void } | undefined;
}

export function ApiceList({ listing, empty, selection }: Props) {
  if (listing.status === 'loading') return null;
  if (listing.status === 'error') {
    return (
      <div role="alert" className="block">
        <p>No se pudo cargar la lista.</p>
        <button type="button" className="block action-secondary" onClick={listing.retry}>
          Reintentar
        </button>
      </div>
    );
  }
  if (listing.empty !== null) return <>{empty(listing.empty)}</>;
  return (
    <section aria-label="Ápices" className="apice-list">
      {listing.items.map((apice) => (
        <ApiceCard
          key={apice.id}
          apice={apice}
          {...(selection === undefined ? {} : { chosen: selection.chosen.includes(apice.id), onToggle: () => selection.onToggle(apice.id) })}
        />
      ))}
      {listing.hasMore && (
        <button type="button" className="block action-secondary" disabled={listing.loadingMore} onClick={listing.loadMore}>
          Cargar más
        </button>
      )}
    </section>
  );
}

/** Las filas del panel de Inicio: una por Ápice, sin cargar más (el mapa ya pidió todas las tandas). */
export function ApiceRows({ apices, currentId = null }: { apices: readonly ApiceCardData[]; currentId?: string | null }) {
  if (apices.length === 0) return null;
  return (
    <ul aria-label="Ápices" className="apice-rows">
      {apices.map((apice) => (
        <ApiceRow key={apice.id} apice={apice} current={apice.id === currentId} />
      ))}
    </ul>
  );
}
