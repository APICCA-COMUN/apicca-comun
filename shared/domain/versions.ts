// Versiones de un ápice: conflicto, ediciones sin cambios y diferencias (RF-11 (001), RF-12 (001), D-T5 (001)).
import { normalizeContent, type ApiceContent, type ApiceStatus, type Axis } from './apice';

/** Lo que una edición puede cambiar: el contenido y el estado. */
export interface EditableFields extends ApiceContent {
  status: ApiceStatus;
}

export type ContentChange =
  | { field: 'name' | 'description' | 'needs' | 'offers' | 'status'; before: string; after: string }
  | { field: 'axes'; added: Axis[]; removed: Axis[] };

/** Hay conflicto cuando alguien guardó una versión nueva desde que se abrió la ficha. */
export function isConflict(baseVersion: number, currentVersion: number): boolean {
  return baseVersion !== currentVersion;
}

const TEXT_FIELDS = ['name', 'description', 'needs', 'offers', 'status'] as const;

/** Diferencias campo por campo, en el orden de la ficha; los ejes se comparan como conjunto. */
export function diffContent(before: EditableFields, after: EditableFields): ContentChange[] {
  const changes: ContentChange[] = [];
  const push = (field: (typeof TEXT_FIELDS)[number]): void => {
    if (before[field] !== after[field]) changes.push({ field, before: before[field], after: after[field] });
  };
  push('name');
  push('description');
  const added = after.axes.filter((axis) => !before.axes.includes(axis));
  const removed = before.axes.filter((axis) => !after.axes.includes(axis));
  if (added.length > 0 || removed.length > 0) changes.push({ field: 'axes', added, removed });
  push('needs');
  push('offers');
  push('status');
  return changes;
}

/** Un guardado que, ya normalizado, no cambia nada no crea versión. */
export function isNoopEdit(current: EditableFields, next: EditableFields): boolean {
  const normalized = { ...next, ...normalizeContent(next), axes: [...next.axes] } as EditableFields;
  return diffContent(current, normalized).length === 0;
}
