// RF-21 (001), RF-6 (002) · Lista de ápices en tandas de 24 por cursor, de la más reciente a la más antigua. Se pide más con
// un botón, no con desplazamiento infinito. El mensaje de lista vacía lo decide quien la usa.
// RF-6 (019) · 6.2, D-T17 (019): la carga, el cursor y los parches viven en `useApiceListing`; la lista solo presenta.
// Mientras carga no pinta nada: el aviso de carga lo da la página (RF-7 (019) · 7.3).
// RF-19 (021) · 19.5: con `selection`, cada tarjeta lleva la casilla «Sumar a la Acción Común».
// «E3 · Celda»: la lista son filas sin caja (`ApiceCard`, con filete suave) y, con `titulo`, abre con su línea de sección. `ApiceRows` es la misma lista en filas cortas (`.c-fila`), la de la columna de Inicio.
import type { ReactNode } from 'react';
import type { EmptyState } from '../../shared/domain/discovery';
import type { ApiceListing } from '../app/useApiceListing';
import { ApiceCard, ApiceRow, type ApiceCardData } from './ApiceCard';

interface Props {
  listing: ApiceListing;
  /** Con `titulo`, la sección abre con su línea «Ápices» y la cuenta (la vista de lista de Inicio). */
  titulo?: boolean;
  /** Qué mostrar si no hay ningún ápice. */
  empty(state: EmptyState): ReactNode;
  /** Mientras se conecta una Acción Común: lo elegido y cómo sumar o quitar. */
  selection?: { chosen: readonly string[]; onToggle(id: string): void } | undefined;
}

export function ApiceList({ listing, empty, selection, titulo = false }: Props) {
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
      {titulo && (
        <div className="c-seccion">
          <h2 className="c-rot">Ápices</h2>
          <span className="c-rot c-suave">
            {listing.items.length}
            {listing.hasMore ? '+' : ''}
          </span>
        </div>
      )}
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

interface RowsProps {
  apices: readonly ApiceCardData[];
  currentId?: string | null;
  /** Los Ápices que el filtro deja fuera: su fila sigue, atenuada (filtrar es atenuar, no quitar). */
  dimmed?: ReadonlySet<string>;
  /** Cuántas filas se dibujan; el resto se resume en una última fila «N Ápices más». Sin `limit`, todas. */
  limit?: number;
  /** Qué hace la fila «N Ápices más» (llevar a la vista de lista). Sin ella, el resumen no se dibuja. */
  onMore?: () => void;
}

/**
 * Las filas de la columna de Inicio («E3 · Celda»): una por Ápice (`.c-fila` de 26 px). Si hay más que `limit`, las primeras y
 * una última fila «N Ápices más»; el Ápice abierto se dibuja siempre, aunque caiga después del corte.
 */
export function ApiceRows({ apices, currentId = null, dimmed, limit, onMore }: RowsProps) {
  if (apices.length === 0) return null;
  const cut = limit !== undefined && onMore !== undefined && apices.length > limit;
  let visible = cut ? apices.slice(0, limit) : apices;
  if (cut && currentId !== null && !visible.some((apice) => apice.id === currentId)) {
    const current = apices.find((apice) => apice.id === currentId);
    if (current !== undefined) visible = [...visible, current];
  }
  const rest = apices.length - visible.length;
  return (
    <ul aria-label="Ápices" className="apice-rows">
      {visible.map((apice) => (
        <ApiceRow key={apice.id} apice={apice} current={apice.id === currentId} dimmed={dimmed?.has(apice.id) === true} />
      ))}
      {cut && rest > 0 && (
        <li className="apice-row">
          <button type="button" className="c-fila c-suave apice-row__mas" onClick={onMore}>
            <span className="c-nm">{rest === 1 ? '1 Ápice más' : `${rest} Ápices más`}</span>
          </button>
        </li>
      )}
    </ul>
  );
}
