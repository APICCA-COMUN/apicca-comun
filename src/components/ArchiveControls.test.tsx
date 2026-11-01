import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../data/api';
import { fakeClient } from '../testing/facilitationDoubles';
import { ArchiveControls } from './ArchiveControls';
import { expectBlocks } from '../testing/expectBlocks';

describe('ArchiveControls', () => {
  it('RF-14 (001): un ápice activo ofrece archivar y llama a archiveApice', async () => {
    const { client, calls } = fakeClient({ archiveApice: () => ({}) });
    render(<ArchiveControls id="a1" isArchived={false} client={client} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(calls).toEqual([{ op: 'archiveApice', payload: { id: 'a1' } }]);
  });

  it('RF-14 (001): un ápice archivado muestra el aviso «archivado» y ofrece solo restaurar', async () => {
    const { client, calls } = fakeClient({ restoreApice: () => ({}) });
    render(<ArchiveControls id="a1" isArchived client={client} />);
    expect(screen.getByText(/archivado/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(calls).toEqual([{ op: 'restoreApice', payload: { id: 'a1' } }]);
  });

  it('RF-14 (001): si la op falla muestra el mensaje', async () => {
    const { client } = fakeClient({
      archiveApice: () => {
        throw new ApiClientError('forbidden');
      },
    });
    render(<ArchiveControls id="a1" isArchived={false} client={client} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No tienes permiso');
  });
});

describe('ArchiveControls · bloques (002)', () => {
  it('RF-6 (002) · 6.3: Archivar y Restaurar son secundarias (la 001 no les pide confirmación ni motivo), con sus etiquetas', () => {
    const { client } = fakeClient({});
    const { unmount, container } = render(<ArchiveControls id="a1" isArchived={false} client={client} />);
    expect(screen.getByRole('button', { name: 'Archivar' }).classList.contains('action-secondary')).toBe(true);
    expectBlocks(container);
    unmount();
    const view = render(<ArchiveControls id="a1" isArchived client={client} />);
    expect(screen.getByRole('button', { name: 'Restaurar' }).classList.contains('action-secondary')).toBe(true);
    expect(screen.getByRole('status').classList.contains('block')).toBe(true);
    expectBlocks(view.container);
  });

  it('RF-6 (002) · 6.1: el aviso de error es un bloque', async () => {
    const { client } = fakeClient({
      archiveApice: () => {
        throw new ApiClientError('forbidden');
      },
    });
    const { container } = render(<ArchiveControls id="a1" isArchived={false} client={client} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await screen.findByRole('alert');
    expectBlocks(container);
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', () => {
    const { client } = fakeClient({});
    const { container, unmount } = render(<ArchiveControls id="a1" isArchived={false} client={client} />);
    expectBlocks(container, { nesting: true });
    unmount();
    const archived = render(<ArchiveControls id="a1" isArchived client={client} />);
    expectBlocks(archived.container, { nesting: true });
  });
});

describe('ArchiveControls · etiquetas (002)', () => {
  it('RF-13 (002) · 13.1, 13.3: el archivo es una etiqueta con el texto de la 001', () => {
    const { client } = fakeClient({});
    const { container } = render(<ArchiveControls id="a1" isArchived client={client} />);
    expect(container.querySelector('.tag[data-condition="archived"]')?.textContent).toBe('archivado');
  });
});
