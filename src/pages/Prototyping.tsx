// RF-12 (003) · 12.4, RF-18 (003) · 18.1 a 18.5, RF-21 (001), RF-6 (002) · 6.3, RF-8 (002) · 8.3, D-T11 (003), RF-2 (017) · Prototipado (`/prototipado`):
// los ápices con los filtros en la URL. Todo lo del mapa se puede hacer desde la lista, y si el mapa falla la lista sigue
// entera (RNF-10 (001)). Con sesión, «Nuevo ápice» es la acción principal.
// RF-9 (008) · 9.1, D-13 (008): sin lote envolvente; el título y las acciones van en una fila.
// RF-8 (005) · 8.1, 8.3, 8.4, RF-7 (005) · 7.8, 7.11, 7.12, D-8 (005), D-10 (005), D-T8 (005), D-T12 (005): el lote
// ilustrado lleva su panel siempre a la vista. Con la edición rápida a la vista, «Nuevo ápice» pasa a secundario. Lo
// guardado en el panel se aplica sin volver a consultar.
// RF-8 (019) · 8.3, D-9 (019) revisada, D-T26 (019): el lote va en zigzag, con sus caminos; en anchos menores, la retícula
// sin caminos (RF-8 (019) · 8.1).
// RF-6 (019) · 6.1 a 6.3, RF-7 (019) · 7.1 a 7.3, D-T17 (019), D-T20 (019): el terreno es la vista principal y la lista
// su alternativa (`?vista=lista`), nunca las dos a la vez; los filtros, el contador y el control de vista van en la
// franja. RF-19 (019), D-T22 (019): sin ápices ni filtros, solo el terreno de partida, y «Nuevo ápice» pasa a secundario.
// RF-10 (019) · 10.1, 10.5, D-T25 (019): el mapa geográfico va después del terreno y solo se monta cuando se pide.
import { useState } from 'react';
import { Link, navigate } from '../app/router';
import { filtersFromSearch, filtersToSearch } from '../app/listFilters';
import { useSession } from '../app/session';
import { useApiceListing } from '../app/useApiceListing';
import { usePageTitle } from '../app/usePageTitle';
import { ApiceMap } from '../components/ApiceMap';
import { ApiceList } from '../components/ApiceList';
import { ApiceLotSection } from '../components/ApiceLotSection';
import { EmptyState } from '../components/EmptyState';
import { Filters } from '../components/Filters';
import { MapBoundary } from '../components/MapView';
import { StartingTerrain } from '../components/StartingTerrain';
import { MAP_REGION_ID, TerrainStrip, viewFromSearch, withView, type ListingView } from '../components/TerrainStrip';
import type { ApiOps, OpClient } from '../data/api';
import { firestoreListSource, type ApiceSource, type ListSource } from '../data/apices';
import type { ListFilters } from '../../shared/domain/discovery';

interface Props {
  source?: ListSource;
  /** Para el panel del lote; sin ellos, los de Firebase. */
  apiceSource?: ApiceSource;
  client?: OpClient<ApiOps>;
}

export function Prototyping({ source = firestoreListSource, apiceSource, client }: Props) {
  usePageTitle({ contentTitle: 'Prototipado' });
  const session = useSession();
  const [filters, setFilters] = useState<ListFilters>(() => filtersFromSearch(window.location.search));
  const [view, setView] = useState<ListingView>(() => viewFromSearch(window.location.search));
  const [editing, setEditing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const person = session.status === 'person';
  const listing = useApiceListing({ audience: person ? 'member' : 'visitor', filters, source });
  const go = (nextFilters: ListFilters, nextView: ListingView) =>
    navigate(`/prototipado${withView(filtersToSearch(nextFilters), nextView)}`, { replace: true });
  const change = (next: ListFilters) => {
    setFilters(next);
    go(next, view);
  };
  const switchView = (next: ListingView) => {
    setView(next);
    go(filters, next);
  };
  if (session.status === 'loading') return <p>Cargando…</p>;
  const starting = listing.empty === 'no-apices';
  const terrain = view === 'terreno' && listing.status !== 'error' && listing.empty === null;
  return (
    <div className="prototyping">
      <header className="prototyping__head">
        <h1>Prototipado de ápices</h1>
        <div className="prototyping__tools">
          {person && (
            <Link href="/apices/nuevo" className={`block ${editing || starting ? 'action-secondary' : 'action-primary'}`}>
              Nuevo ápice
            </Link>
          )}
          {person && <Link href="/archivados">Archivados</Link>}
        </div>
      </header>
      {starting ? (
        <StartingTerrain
          phrase="Aún no hay ápices en el terreno."
          action={person ? { label: 'Propón el primer ápice', href: '/apices/nuevo' } : { label: 'Pide tu inscripción', href: '/solicitar' }}
        />
      ) : (
        <>
          <TerrainStrip listing={listing} view={view} onView={switchView} map={{ open: mapOpen, onToggle: () => setMapOpen(!mapOpen) }}>
            <Filters filters={filters} onChange={change} />
          </TerrainStrip>
          {terrain ? (
            <ApiceLotSection
              items={listing.items}
              loading={listing.status === 'loading'}
              alwaysPanel
              layout="trail"
              {...(apiceSource === undefined ? {} : { source: apiceSource })}
              {...(client === undefined ? {} : { client })}
              onSaved={listing.patch}
              onEditingChange={setEditing}
            />
          ) : (
            <ApiceList
              listing={listing}
              empty={(kind) => <EmptyState kind={kind} canCreate={person} onClearFilters={() => change({ axes: [], status: null })} />}
            />
          )}
          <div id={MAP_REGION_ID} className="terrain-map">
            {mapOpen && (
              <MapBoundary>
                <ApiceMap
                  apices={listing.items.map((a) => ({ id: a.id, name: a.name, axes: a.axes, location: a.location ?? null }))}
                  onSelect={(id) => navigate(`/apices/${id}`)}
                />
              </MapBoundary>
            )}
          </div>
        </>
      )}
    </div>
  );
}
