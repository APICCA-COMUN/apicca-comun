// Auxiliares de prueba (RF-4 (003) · 4.2, 4.7; D-T5 (003)): cuentan los botones azules que se ven,
// con la misma regla que el CSS del diálogo abierto (D-T6 (003)).
import { expect } from 'vitest';

const isHidden = (element: Element): boolean => element.closest('[hidden], [aria-hidden="true"]') !== null;

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** El nombre del botón: `aria-label` o su texto. */
const nameOf = (element: Element): string => squash(element.getAttribute('aria-label') ?? element.textContent ?? '');

/** Los `.action-primary` visibles; con un `[role=dialog]` abierto, solo los de dentro. */
export function primaryActions(container: ParentNode): HTMLElement[] {
  const dialogs = [...container.querySelectorAll<HTMLElement>('[role="dialog"]')].filter((d) => !isHidden(d));
  const scopes: ParentNode[] = dialogs.length > 0 ? dialogs : [container];
  return scopes.flatMap((scope) =>
    [...scope.querySelectorAll<HTMLElement>('.action-primary')].filter((element) => !isHidden(element)),
  );
}

/** Falla listando los botones azules hallados, o echando en falta el esperado; `null` exige ninguno. */
export function expectOnePrimary(container: ParentNode, name: string | null): void {
  const found = primaryActions(container).map(nameOf);
  expect(found, name === null ? 'se esperaba ningún botón azul' : `se esperaba un solo botón azul «${name}»`).toEqual(
    name === null ? [] : [name],
  );
}
