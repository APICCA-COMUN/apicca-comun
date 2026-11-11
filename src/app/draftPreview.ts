// RF-14 (021) · 14.4, D-T23 (021): mientras se llena «Construir ápice» o «Editar ápice», el mapa muestra el edificio tal
// como quedará. Lee el borrador que guarda el formulario (`ContentForm`, en `DraftsContext`) y devuelve los ápices del
// mapa con ese cambio; si no hay nada que mostrar, devuelve el mismo arreglo.
import { APICE_STATUSES, AXES, INITIAL_APICE_STATUS, type ApiceStatus, type Axis } from '../../shared/domain/apice';
import type { ListedApice } from '../data/apices';

/** Qué panel está abierto sobre el mapa: los del ápice; desde la fase 4, el de un camino y «Trazar camino» (D-T29 (021)); desde la 5, el boceto (D-T39 (021)). */
export type PanelState =
  | { kind: 'view'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'new' }
  | { kind: 'action'; id: string }
  | { kind: 'trace' }
  | { kind: 'sketch' }
  | null;

/** Id del edificio en construcción; ningún documento lo usa. */
export const NEW_PREVIEW_ID = '__nuevo__';

/** Nombre del edificio en construcción mientras no se escribe uno (§4 de plan.md, por confirmar). */
const UNNAMED = 'Nuevo ápice';

/** Clave del borrador del formulario de cada panel; `null` si el panel no tiene formulario. */
export function draftKeyOf(panel: PanelState): string | null {
  if (panel === null) return null;
  if (panel.kind === 'new') return 'apice:new';
  return panel.kind === 'edit' ? `apice:${panel.id}` : null;
}

interface DraftShape {
  name: string;
  axes: Axis[];
  status: ApiceStatus | null;
}

function readDraft(text: string): DraftShape | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const chosen = Array.isArray(record.axes) ? record.axes : [];
  return {
    name: typeof record.name === 'string' ? record.name.trim() : '',
    // En el orden canónico, como los guarda el servidor.
    axes: AXES.filter((axis) => chosen.includes(axis)),
    status: APICE_STATUSES.find((status) => status === record.status) ?? null,
  };
}

export function previewItems(items: ListedApice[], panel: PanelState, draftText: string | undefined): ListedApice[] {
  if (draftText === undefined || draftKeyOf(panel) === null) return items;
  const draft = readDraft(draftText);
  if (draft === null) return items;
  if (panel?.kind === 'new') {
    if (draft.axes.length === 0) return items;
    const building: ListedApice = {
      id: NEW_PREVIEW_ID,
      name: draft.name === '' ? UNNAMED : draft.name,
      description: '',
      axes: draft.axes,
      status: INITIAL_APICE_STATUS,
      updatedAt: { seconds: 0, nanoseconds: 0 },
      needs: '',
      location: null,
    };
    return [...items, building];
  }
  if (panel?.kind !== 'edit') return items;
  const id = panel.id;
  return items.map((item) =>
    item.id === id
      ? { ...item, axes: draft.axes.length === 0 ? item.axes : draft.axes, status: draft.status ?? item.status }
      : item,
  );
}
