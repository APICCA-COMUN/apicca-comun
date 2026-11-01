// RF-7 (004) · 7.2: pruebas de la lista de propuestas cerradas paginadas de 20 en 20 con resultado y motivos.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Amendment } from '../../shared/domain/constitution/types';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { ClosedAmendments } from './ClosedAmendments';

function createClosedAmendment(n: number): Amendment {
  const isApproved = n % 3 === 0;
  const isWithdrawn = n % 3 === 1;
  const isRejected = n % 3 === 2;

  return {
    id: `amendment-${n}`,
    kind: 'change',
    sectionId: `sec-${n}`,
    after: null,
    slotKey: `s:sec-${n}`,
    title: `Propuesta de cambio número ${n}`,
    text: `Texto de la propuesta ${n}`,
    motive: `Motivo de la propuesta ${n}`,
    revisionNo: 1,
    baseSectionVersion: 1,
    authorUid: `uid-${n}`,
    authorUsername: `persona_${n}`,
    authorSuspended: false,
    openedAt: 1_790_000_000_000 + n * 1_000,
    closesAt: 1_790_000_000_000 + (n + 10) * 1_000,
    extended: false,
    isOpen: false,
    result: isApproved ? 'approved' : isWithdrawn ? 'withdrawn' : 'rejected',
    reasons: isRejected ? ['insufficient_agreements', 'open_objection'] : [],
    closedAt: 1_790_000_000_000 + n * 10_000,
    agreementsCounted: isApproved ? 5 : 1,
    objectionsResolved: 0,
    objectionsWithdrawn: 0,
    newSectionId: null,
  };
}

describe('ClosedAmendments', () => {
  it('RF-7 (004) · 7.2: muestra 45 propuestas cerradas paginadas 20, 20 y 5, de más recientes a más antiguas con resultado y motivos', async () => {
    // Creamos 45 cerradas desordenadas para comprobar el ordenamiento por closedAt desc
    const items45: Amendment[] = Array.from({ length: 45 }, (_, i) => createClosedAmendment(i + 1)).reverse();
    // La más reciente es la 45 (mayor closedAt)
    const { container } = render(<ClosedAmendments amendments={items45} />);

    // 1. Inicialmente se muestran 20
    let items = screen.getAllByRole('heading', { level: 3 });
    expect(items.length).toBe(20);
    // La primera debe ser la más reciente (número 45)
    expect(items[0]?.textContent).toContain('número 45');

    // 2. Muestra resultado y motivos en las propuestas
    expect(container.textContent).toMatch(/Aprobada/);
    expect(container.textContent).toMatch(/Retirada/);
    expect(container.textContent).toMatch(/No aprobada|Rechazada/);
    expect(container.textContent).toMatch(/Acuerdos insuficientes/);
    expect(container.textContent).toMatch(/Objeción abierta/);

    // 3. Sin botones de acción principal (sin botón azul)
    expectOnePrimary(container, null);
    expectBlocks(container);

    // 4. Botón secundario para ver más
    const moreBtn = screen.getByRole('button', { name: /ver más|cargar más/i });
    expect(moreBtn.className).toContain('action-secondary');

    // 5. Clic 1 -> pasa a 40
    await userEvent.click(moreBtn);
    items = screen.getAllByRole('heading', { level: 3 });
    expect(items.length).toBe(40);

    // 6. Clic 2 -> pasa a 45 y el botón desaparece
    await userEvent.click(screen.getByRole('button', { name: /ver más|cargar más/i }));
    items = screen.getAllByRole('heading', { level: 3 });
    expect(items.length).toBe(45);
    expect(screen.queryByRole('button', { name: /ver más|cargar más/i })).toBeNull();
  });

  it('RF-7 (004) · 7.2: muestra estado vacío cuando no hay propuestas cerradas', () => {
    const { container } = render(<ClosedAmendments amendments={[]} />);
    expect(container.textContent).toMatch(/no hay propuestas cerradas/i);
    expectBlocks(container);
  });
});
