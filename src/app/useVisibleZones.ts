// RF-12 (024) · 12.1 a 12.3, D-T16 (024): las zonas de los ápices que la persona ve, para que el selector de ubicación abra
// sobre ellos. Lee la primera tanda de la lista (la misma que ve con cuenta, sin filtros) y se queda solo con el centro de la
// zona de cada uno: esa zona ya es pública; el punto exacto de un ápice nunca sale de aquí (D-10 (024)). Los que no traen zona
// no cuentan. Mientras se lee, o si la lectura falla, no hay zonas y el selector abre como hoy.
import { useMemo } from 'react';
import { NO_FILTERS } from '../../shared/domain/discovery';
import type { Point } from '../../shared/domain/location';
import { firestoreListSource, type ListSource } from '../data/apices';
import { useApiceListing } from './useApiceListing';

interface Options {
  /** Fuente de la lista; por omisión, la de Firestore. */
  source?: ListSource;
  /** Falso: no lee nada (el formulario no muestra mapa). */
  enabled?: boolean;
}

const NOTHING: ListSource = { fetchPage: async () => ({ items: [], cursor: null }) };

export function useVisibleZones({ source = firestoreListSource, enabled = true }: Options = {}): readonly Point[] {
  // Una lectura que falla de golpe (sin Firebase, por ejemplo) se vuelve un rechazo, que el listado ya sabe llevar a «error».
  const safe = useMemo<ListSource>(() => (enabled ? { fetchPage: async (request) => source.fetchPage(request) } : NOTHING), [enabled, source]);
  const listing = useApiceListing({ audience: 'member', filters: NO_FILTERS, source: safe });
  return useMemo(
    () => listing.items.flatMap((apice) => (apice.location?.zone ? [{ lat: apice.location.zone.lat, lng: apice.location.zone.lng }] : [])),
    [listing.items],
  );
}
