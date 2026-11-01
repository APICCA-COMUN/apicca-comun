// RF-21 (001), RF-6 (002) · Lista de ápices en tandas de 24 por cursor, de la más reciente a la más antigua. Se pide más con
// un botón, no con desplazamiento infinito. El mensaje de lista vacía lo decide quien la usa.
// RF-7 (005) · 7.8, D-T5 (005): `patches` aplica lo guardado en el panel del lote sin volver a consultar.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyState, type EmptyState, type ListAudience, type ListFilters } from '../../shared/domain/discovery';
import type { ListCursor, ListedApice, ListSource } from '../data/apices';
import { ApiceCard } from './ApiceCard';

interface Props {
  audience: ListAudience;
  filters: ListFilters;
  uid?: string;
  source: ListSource;
  /** Avisa de los ápices cargados, para que otra vista (el mapa) muestre los mismos. */
  onItems?(items: readonly ListedApice[]): void;
  /** Cambios locales por id, ya guardados, que se pintan sobre lo consultado. */
  patches?: Readonly<Record<string, Partial<ListedApice>>>;
  /** Qué mostrar si no hay ningún ápice. */
  empty(state: EmptyState): ReactNode;
}

export function ApiceList({ audience, filters, uid, source, onItems, patches, empty }: Props) {
  const [items, setItems] = useState<ListedApice[]>([]);
  const [cursor, setCursor] = useState<ListCursor | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  // Descarta lo que llega de una consulta que ya no es la vigente (cambió un filtro).
  const generation = useRef(0);
  const filtersKey = `${audience}|${uid ?? ''}|${filters.axes.join(',')}|${filters.status ?? ''}`;

  const load = useCallback(
    (from: ListCursor | null) => {
      const mine = generation.current;
      setStatus((current) => (from === null ? 'loading' : current));
      source
        .fetchPage({ audience, filters, ...(uid === undefined ? {} : { uid }), cursor: from })
        .then((page) => {
          if (mine !== generation.current) return;
          setItems((current) => (from === null ? page.items : [...current, ...page.items]));
          setCursor(page.cursor);
          setStatus('ready');
          setMore(false);
        })
        .catch(() => {
          if (mine !== generation.current) return;
          setStatus('error');
          setMore(false);
        });
    },
    // `filtersKey` resume audience, uid y filters.
    [source, filtersKey],
  );

  useEffect(() => {
    generation.current += 1;
    setItems([]);
    setCursor(null);
    load(null);
  }, [load]);

  const shown = useMemo(
    () => (patches === undefined ? items : items.map((apice) => (patches[apice.id] ? { ...apice, ...patches[apice.id] } : apice))),
    [items, patches],
  );

  useEffect(() => {
    onItems?.(shown);
  }, [shown]);

  if (status === 'loading') return <p>Cargando…</p>;
  if (status === 'error') {
    return (
      <div role="alert" className="block">
        <p>No se pudo cargar la lista.</p>
        <button type="button" className="block action-secondary" onClick={() => load(items.length > 0 ? cursor : null)}>
          Reintentar
        </button>
      </div>
    );
  }
  const state = emptyState({ count: items.length, filters });
  if (state !== null) return <>{empty(state)}</>;
  return (
    <section aria-label="Ápices">
      {shown.map((apice) => (
        <ApiceCard key={apice.id} apice={apice} />
      ))}
      {cursor !== null && (
        <button
          type="button"
          className="block action-secondary"
          disabled={more}
          onClick={() => {
            setMore(true);
            load(cursor);
          }}
        >
          Cargar más
        </button>
      )}
    </section>
  );
}
