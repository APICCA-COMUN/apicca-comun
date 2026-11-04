// RF-6 (019), RF-7 (019) · 7.3, D-T17 (019): listado de ápices que comparten el terreno, la lista y el mapa. Pide tandas
// de 24 por cursor, de la más reciente a la más antigua (RF-21 (001)), descarta lo que llega de una consulta que ya no
// es la vigente y aplica lo guardado en el panel del lote sin volver a consultar (RF-7 (005) · 7.8, D-T5 (005)).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyState, type EmptyState, type ListAudience, type ListFilters } from '../../shared/domain/discovery';
import type { ListCursor, ListedApice, ListSource } from '../data/apices';

export interface ApiceListingRequest {
  audience: ListAudience;
  filters: ListFilters;
  uid?: string;
  source: ListSource;
}

export interface ApiceListing {
  status: 'loading' | 'ready' | 'error';
  /** Ápices cargados, con los parches aplicados. */
  items: readonly ListedApice[];
  /** Qué vacío mostrar, solo cuando la lista ya llegó; si no, `null`. */
  empty: EmptyState | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore(): void;
  retry(): void;
  patch(id: string, fields: Partial<ListedApice>): void;
}

export function useApiceListing({ audience, filters, uid, source }: ApiceListingRequest): ApiceListing {
  const [items, setItems] = useState<ListedApice[]>([]);
  const [cursor, setCursor] = useState<ListCursor | null>(null);
  const [status, setStatus] = useState<ApiceListing['status']>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [patches, setPatches] = useState<Readonly<Record<string, Partial<ListedApice>>>>({});
  // Descarta lo que llega de una consulta que ya no es la vigente (cambió un filtro).
  const generation = useRef(0);
  const filtersKey = `${audience}|${uid ?? ''}|${filters.axes.join(',')}|${filters.status ?? ''}`;

  const load = useCallback(
    (from: ListCursor | null) => {
      const mine = generation.current;
      if (from === null) setStatus('loading');
      source
        .fetchPage({ audience, filters, ...(uid === undefined ? {} : { uid }), cursor: from })
        .then((page) => {
          if (mine !== generation.current) return;
          setItems((current) => (from === null ? page.items : [...current, ...page.items]));
          setCursor(page.cursor);
          setStatus('ready');
          setLoadingMore(false);
        })
        .catch(() => {
          if (mine !== generation.current) return;
          setStatus('error');
          setLoadingMore(false);
        });
    },
    // `filtersKey` resume audience, uid y filters.
    [source, filtersKey],
  );

  useEffect(() => {
    generation.current += 1;
    setItems([]);
    setCursor(null);
    setLoadingMore(false);
    load(null);
  }, [load]);

  const shown = useMemo(() => items.map((apice) => (patches[apice.id] ? { ...apice, ...patches[apice.id] } : apice)), [items, patches]);

  return {
    status,
    items: shown,
    empty: status === 'ready' ? emptyState({ count: items.length, filters }) : null,
    hasMore: cursor !== null,
    loadingMore,
    loadMore: () => {
      if (cursor === null || loadingMore) return;
      setLoadingMore(true);
      load(cursor);
    },
    retry: () => load(items.length > 0 ? cursor : null),
    patch: (id, fields) => setPatches((current) => ({ ...current, [id]: { ...current[id], ...fields } })),
  };
}
