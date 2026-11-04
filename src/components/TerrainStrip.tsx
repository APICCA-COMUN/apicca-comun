// RF-7 (019) · 7.1, 7.3, RF-6 (019) · 6.2, D-T20 (019) · Franja sobre el terreno, fuera de su área: los filtros (si la página
// los tiene), el contador de ápices y el control de texto que cambia entre el terreno y la lista. Mientras carga, el
// contador dice «Cargando ápices…» y no que no hay ápices. RF-12 (003) · 12.4, RF-9 (008) · 9.2: el contador es un
// role=status con un ícono decorativo.
// RF-10 (019) · 10.5, D-T25 (019): «Ver en el mapa» / «Ocultar el mapa» abre y cierra el mapa geográfico, que la página
// monta solo cuando está abierto; `aria-controls` apunta al contenedor que la página deja siempre en su lugar. Sin
// ápices la página no pinta la franja, así que tampoco el control (RF-19 (019) · 19.4).
import type { ReactNode } from 'react';
import type { ApiceListing } from '../app/useApiceListing';
import './TerrainStrip.css';

export type ListingView = 'terreno' | 'lista';

/** La vista guardada en la URL: `?vista=lista` o, sin el parámetro, el terreno (D-T20 (019)). */
export function viewFromSearch(search: string): ListingView {
  return new URLSearchParams(search).get('vista') === 'lista' ? 'lista' : 'terreno';
}

/** Suma la vista a una búsqueda (`?ejes=…` o vacía) y devuelve la búsqueda completa, con `?` o vacía. */
export function withView(search: string, view: ListingView): string {
  const params = new URLSearchParams(search);
  if (view === 'lista') params.set('vista', 'lista');
  else params.delete('vista');
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/** El contenedor del mapa geográfico, al que apunta `aria-controls` (RF-10 (019) · 10.5). */
export const MAP_REGION_ID = 'mapa-apices';

interface Props {
  listing: ApiceListing;
  view: ListingView;
  onView(view: ListingView): void;
  /** Los filtros de la página, si los tiene. */
  children?: ReactNode;
  /** El mapa geográfico a pedido (RF-10 (019) · 10.5), si la página lo tiene. */
  map?: { open: boolean; onToggle(): void };
}

export function TerrainStrip({ listing, view, onView, children, map }: Props) {
  const count = listing.items.length;
  return (
    <div className="apice-lot-section__strip">
      {children}
      <p role="status" className="block filters-count">
        <svg className="filters-count__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {listing.status === 'loading' ? 'Cargando ápices…' : `${count} ${count === 1 ? 'ápice' : 'ápices'}`}
      </p>
      <button type="button" className="block action-secondary" onClick={() => onView(view === 'terreno' ? 'lista' : 'terreno')}>
        {view === 'terreno' ? 'Ver como lista' : 'Ver como terreno'}
      </button>
      {map && (
        <button type="button" className="block action-secondary" aria-expanded={map.open} aria-controls={MAP_REGION_ID} onClick={map.onToggle}>
          {map.open ? 'Ocultar el mapa' : 'Ver en el mapa'}
        </button>
      )}
    </div>
  );
}
