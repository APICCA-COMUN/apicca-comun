// RF-21 (001), RF-6 (002) · Lista de ápices en tandas de 24 por cursor, de la más reciente a la más antigua. Se pide más con
// un botón, no con desplazamiento infinito. El mensaje de lista vacía lo decide quien la usa.
// RF-6 (019) · 6.2, D-T17 (019): la carga, el cursor y los parches viven en `useApiceListing`; la lista solo presenta.
// Mientras carga no pinta nada: el aviso de carga lo da la página (RF-7 (019) · 7.3).
import type { ReactNode } from 'react';
import type { EmptyState } from '../../shared/domain/discovery';
import type { ApiceListing } from '../app/useApiceListing';
import { ApiceCard } from './ApiceCard';

interface Props {
  listing: ApiceListing;
  /** Qué mostrar si no hay ningún ápice. */
  empty(state: EmptyState): ReactNode;
}

export function ApiceList({ listing, empty }: Props) {
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
    <section aria-label="Ápices">
      {listing.items.map((apice) => (
        <ApiceCard key={apice.id} apice={apice} />
      ))}
      {listing.hasMore && (
        <button type="button" className="block action-secondary" disabled={listing.loadingMore} onClick={listing.loadMore}>
          Cargar más
        </button>
      )}
    </section>
  );
}
