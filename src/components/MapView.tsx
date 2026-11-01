// RF-21 (001), RF-6 (002), RF-2 (002) · Mapa del inicio: Leaflet llega en un trozo de carga diferida y, si no carga o falla,
// solo el mapa cede su lugar a un aviso; la lista no se toca (RNF-10 (001), D-T11 (001)).
import { Component, lazy, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { MapMarker } from '../map/types';
import './MapView.css';

const LeafletMap = lazy(() => import('../map/LeafletMap'));

export interface MapViewProps {
  markers: readonly MapMarker[];
  onSelect?: (id: string) => void;
  /** Nombre accesible de la región del mapa. */
  label?: string;
}

interface BoundaryState {
  failed: boolean;
}

export class MapBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('El mapa falló', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return <p role="alert" className="block">El mapa no cargó. La lista sigue disponible.</p>;
    }
    return this.props.children;
  }
}

export function MapView({ markers, onSelect, label = 'Mapa de ápices' }: MapViewProps) {
  return (
    <section aria-label={label} className="map-view">
      <MapBoundary>
        <Suspense fallback={<p role="status" className="block">Cargando el mapa…</p>}>
          <LeafletMap markers={markers} {...(onSelect ? { onSelect } : {})} />
        </Suspense>
      </MapBoundary>
    </section>
  );
}
