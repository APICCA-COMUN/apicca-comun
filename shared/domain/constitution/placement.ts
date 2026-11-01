// Lugar de una sección nueva al aprobar una propuesta de añadir (RF-13 (004), D-T3 (004)).
// `order` incluye las retiradas, así se sabe dónde estaba la referencia aunque ya no esté vigente.

/**
 * Posición del arreglo `order` donde insertar la sección nueva: detrás de la sección `after` si sigue vigente,
 * o detrás de la vigente anterior más cercana si se retiró; 0 si `after` es nulo o no queda ninguna.
 */
export function placeNewSection(order: readonly string[], vigentes: ReadonlySet<string>, after: string | null): number {
  if (after === null) return 0;
  for (let i = order.indexOf(after); i >= 0; i--) {
    const id = order[i];
    if (id !== undefined && vigentes.has(id)) return i + 1;
  }
  return 0;
}
