// RF-9 (004) · 9.1–9.3; RF-16 (004) · 16.3; RF-17 (004) · 17.1: pruebas de la deliberación de propuestas.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../data/api';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';
import { DeliberationList, type DeliberationComment } from './DeliberationList';

describe('DeliberationList', () => {
  const at1 = Date.parse('2026-10-05T10:00:00Z');
  const at2 = Date.parse('2026-10-06T14:00:00Z');

  const c1: DeliberationComment = {
    id: 'com-1',
    text: 'Me parece clave consultar [la guía](https://ejemplo.org) antes.',
    authorUid: 'uid-ana',
    authorUsername: 'ana',
    createdAt: at1,
    editedAt: null,
    version: 1,
    archived: false,
    archivedBy: null,
    archivedByUsername: null,
    archivedAt: null,
  };

  const cArchivado: DeliberationComment = {
    id: 'com-arch',
    text: 'Texto que fue archivado.',
    authorUid: 'uid-pedro',
    authorUsername: 'pedro',
    createdAt: at2,
    editedAt: null,
    version: 1,
    archived: true,
    archivedBy: 'uid-fabi',
    archivedByUsername: 'fabi_facilitadora',
    archivedAt: at2 + 1000,
  };

  it('RF-9 (004) · 9.2: autora o facilitador pueden archivar con confirmación destructiva y deja marcador visible con quién archivó', async () => {
    const onArchive = vi.fn();
    const user = userEvent.setup();

    const { container, rerender } = render(
      <DeliberationList
        comments={[c1, cArchivado]}
        isOpen={true}
        currentUid="uid-ana"
        isFacilitator={false}
        onArchive={onArchive}
      />,
    );

    // 1. Marcador visible de archivado indicando quién lo archivó (RF-9 (004) · 9.2)
    expect(container.textContent).toMatch(/archivado por fabi_facilitadora/i);
    // El comentario archivado no tiene acciones de editar ni archivar
    expect(screen.queryByRole('button', { name: /archivar comentario com-arch/i })).toBeNull();

    // 2. Comentario activo de la autora: muestra botón «Archivar» destructivo
    const archiveBtn = screen.getByRole('button', { name: /archivar/i });
    expect(archiveBtn.className).toContain('action-destructive');

    // 3. Confirmación destructiva: al pulsar pide confirmación
    await user.click(archiveBtn);
    const confirmBtn = screen.getByRole('button', { name: /confirmar archivo/i });
    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    expect(confirmBtn.className).toContain('action-destructive');
    expect(cancelBtn.className).toContain('action-secondary');

    // Si cancela, no llama a onArchive y vuelve
    await user.click(cancelBtn);
    expect(onArchive).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /archivar/i })).toBeDefined();

    // Si confirma, llama a onArchive con el id
    await user.click(screen.getByRole('button', { name: /archivar/i }));
    await user.click(screen.getByRole('button', { name: /confirmar archivo/i }));
    expect(onArchive).toHaveBeenCalledWith('com-1');

    // 4. Facilitador también puede archivar aunque no sea autor (RF-9 (004) · 9.2)
    rerender(
      <DeliberationList
        comments={[c1]}
        isOpen={true}
        currentUid="uid-otro"
        isFacilitator={true}
        onArchive={onArchive}
      />,
    );
    expect(screen.getByRole('button', { name: /archivar/i })).toBeDefined();

    // Sin botón azul y estructura de bloques
    expectOnePrimary(container, null);
    expectBlocks(container);
  });

  it('RF-9 (004) · 9.2: con propuesta abierta la autora puede editar con acción secundaria, y con propuesta cerrada no hay editar', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    // 1. Propuesta abierta + autora: botón «Editar» secundaria
    const { container, rerender } = render(
      <DeliberationList
        comments={[c1]}
        isOpen={true}
        currentUid="uid-ana"
        isFacilitator={false}
        onEdit={onEdit}
      />,
    );

    const editBtn = screen.getByRole('button', { name: /editar/i });
    expect(editBtn.className).toContain('action-secondary');
    expect(editBtn.className).not.toContain('action-primary');

    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(c1);

    // Texto con formato y enlace
    const link = screen.getByRole('link', { name: /la guía/i });
    expect(link.getAttribute('href')).toBe('https://ejemplo.org');

    // 2. Propuesta cerrada (RF-9 (004) · 9.3): no hay editar para nadie
    rerender(
      <DeliberationList
        comments={[c1]}
        isOpen={false}
        currentUid="uid-ana"
        isFacilitator={false}
        onEdit={onEdit}
      />,
    );
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull();

    // 3. Propuesta abierta pero persona ajena: no hay editar
    rerender(
      <DeliberationList
        comments={[c1]}
        isOpen={true}
        currentUid="uid-ajena"
        isFacilitator={false}
        onEdit={onEdit}
      />,
    );
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull();

    expectOnePrimary(container, null);
    expectBlocks(container);
  });

  it('RF-17 (004) · 17.1: al fallar la edición con ApiClientError muestra el error en español y conserva el texto escrito', async () => {
    const onSaveEdit = vi.fn().mockRejectedValue(new ApiClientError('amendment-closed'));
    const user = userEvent.setup();

    render(
      <DeliberationList
        comments={[c1]}
        isOpen={true}
        currentUid="uid-ana"
        onSaveEdit={onSaveEdit}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    const textarea = screen.getByLabelText(/texto del comentario/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe(c1.text);

    await user.clear(textarea);
    await user.type(textarea, 'Texto corregido con propuesta');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSaveEdit).toHaveBeenCalledWith('com-1', 'Texto corregido con propuesta');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('La propuesta ya cerró');
    expect(textarea.value).toBe('Texto corregido con propuesta');
  });
});
