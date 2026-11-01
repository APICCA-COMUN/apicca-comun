// Dobles de la lista de ápices para las pruebas de UI: una fuente en memoria que pagina por cursor.
import { vi } from 'vitest';
import type { ListCursor, ListedApice, ListPage, ListRequest, ListSource } from '../data/apices';
import { PAGE_SIZE } from '../../shared/domain/discovery';

export function listed(n: number, extra: Partial<ListedApice> = {}): ListedApice {
  return {
    id: `a${n}`,
    name: `Ápice ${n}`,
    description: `Descripción ${n}`,
    axes: ['agua'],
    status: 'idea',
    updatedAt: { seconds: 1_790_000_000 - n, nanoseconds: 0 },
    image: null,
    ...extra,
  };
}

/** Fuente con `total` ápices; el cursor es la posición donde seguir. Aplica `pick` a cada petición. */
export function fakeListSource(total: number, pick: (request: ListRequest) => ListedApice[] = () => []) {
  const requests: ListRequest[] = [];
  const all = Array.from({ length: total }, (_, i) => listed(i + 1));
  const fetchPage = vi.fn(async (request: ListRequest): Promise<ListPage> => {
    requests.push(request);
    const base = pick(request).length > 0 ? pick(request) : all;
    const from = request.cursor ? Number(request.cursor as unknown as number) : 0;
    const items = base.slice(from, from + PAGE_SIZE);
    const next = from + PAGE_SIZE;
    return { items, cursor: next < base.length ? (next as unknown as ListCursor) : null };
  });
  const source: ListSource = { fetchPage };
  return { source, requests, fetchPage };
}

/** Fuente que siempre devuelve una lista vacía. */
export function emptyListSource() {
  const requests: ListRequest[] = [];
  const source: ListSource = {
    fetchPage: vi.fn(async (request: ListRequest) => {
      requests.push(request);
      return { items: [], cursor: null };
    }),
  };
  return { source, requests };
}
