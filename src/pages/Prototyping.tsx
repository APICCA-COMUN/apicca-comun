// RF-12 (003) · 12.4, RF-18 (003) · 18.1 a 18.5, RF-21 (001), RF-6 (002) · 6.3, RF-8 (002) · 8.3, D-T11 (003) · Prototipado (`/prototipado`):
// mapa y lista de ápices con los mismos filtros en la URL, dentro de un lote. Todo lo del mapa se hace desde la
// lista, y si el mapa falla la lista sigue entera (RNF-10 (001)). Con sesión, «Nuevo ápice» es la acción principal.
// RF-9 (008) · 9.1 a 9.6, D-13 (008): sin lote envolvente; el título, el contador y las acciones van en una fila.
// RF-8 (005) · 8.1 a 8.5, RF-6 (005) · 6.10, RF-7 (005) · 7.8, 7.11, 7.12, D-8 (005), D-10 (005), D-11 (005), D-T8 (005),
// D-T12 (005): encima del mapa y la lista va el lote ilustrado en zigzag con su panel siempre a la vista y los filtros
// flotando sobre su borde; el contador va a la derecha del título. Con la edición rápida a la vista,
// «Nuevo ápice» pasa a secundario. Lo guardado en el panel se aplica a la lista sin volver a consultar.
import { useState } from 'react';
import { Link, navigate } from '../app/router';
import { filtersFromSearch, filtersToSearch } from '../app/listFilters';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { ApiceMap } from '../components/ApiceMap';
import { ApiceList } from '../components/ApiceList';
import { ApiceLotSection } from '../components/ApiceLotSection';
import { EmptyState } from '../components/EmptyState';
import { Filters } from '../components/Filters';
import { MapBoundary } from '../components/MapView';
import type { ApiOps, OpClient } from '../data/api';
import { firestoreListSource, type ApiceSource, type ListedApice, type ListSource } from '../data/apices';
import type { ListFilters } from '../../shared/domain/discovery';

interface Props {
  source?: ListSource;
  /** Para el panel del lote; sin ellos, los de Firebase. */
  apiceSource?: ApiceSource;
  client?: OpClient<ApiOps>;
}

export function Prototyping({ source = firestoreListSource, apiceSource, client }: Props) {
  usePageTitle({});
  const session = useSession();
  const [filters, setFilters] = useState<ListFilters>(() => filtersFromSearch(window.location.search));
  const [items, setItems] = useState<readonly ListedApice[]>([]);
  const [patches, setPatches] = useState<Record<string, Partial<ListedApice>>>({});
  const [editing, setEditing] = useState(false);
  const change = (next: ListFilters) => {
    setFilters(next);
    navigate(`/prototipado${filtersToSearch(next)}`, { replace: true });
  };
  if (session.status === 'loading') return <p>Cargando…</p>;
  const person = session.status === 'person';
  return (
    <div className="prototyping">
      <header className="prototyping__head">
        <h1>Prototipado de ápices</h1>
        <div className="prototyping__tools">
          <p role="status" className="block filters-count">
            <svg className="filters-count__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {items.length} {items.length === 1 ? 'ápice' : 'ápices'}
          </p>
          {person && (
            <Link href="/apices/nuevo" className={`block ${editing ? 'action-secondary' : 'action-primary'}`}>
              Nuevo ápice
            </Link>
          )}
          {person && <Link href="/archivados">Archivados</Link>}
        </div>
      </header>
        <ApiceLotSection
          items={items}
          layout="trail"
          alwaysPanel
          toolbar={<Filters filters={filters} onChange={change} />}
          {...(apiceSource === undefined ? {} : { source: apiceSource })}
          {...(client === undefined ? {} : { client })}
          onSaved={(id, fields) => setPatches((current) => ({ ...current, [id]: { ...current[id], ...fields } }))}
          onEditingChange={setEditing}
        />
        <MapBoundary>
          <ApiceMap
            apices={items.map((a) => ({ id: a.id, name: a.name, axes: a.axes, location: a.location ?? null }))}
            onSelect={(id) => navigate(`/apices/${id}`)}
          />
        </MapBoundary>
        <ApiceList
          onItems={setItems}
          patches={patches}
          audience={person ? 'member' : 'visitor'}
          filters={filters}
          source={source}
          empty={(kind) => (
            <EmptyState kind={kind} canCreate={person} onClearFilters={() => change({ axes: [], status: null })} />
          )}
        />
    </div>
  );
}
