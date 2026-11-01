import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../data/api';
import { fakeClient } from '../testing/facilitationDoubles';
import { VisibilityControl } from './VisibilityControl';
import { expectBlocks } from '../testing/expectBlocks';

describe('VisibilityControl', () => {
  it('RF-13 (001): un ápice privado ofrece hacerlo público y llama a la op', async () => {
    const { client, calls } = fakeClient({ setVisibility: () => ({}) });
    render(<VisibilityControl id="a1" visibility="private" client={client} />);
    expect(screen.getByText(/privado/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Hacer público' }));
    expect(calls).toEqual([{ op: 'setVisibility', payload: { id: 'a1', visibility: 'public' } }]);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('RF-13 (001): un ápice público ofrece hacerlo privado y avisa que dejará de verse', async () => {
    const { client, calls } = fakeClient({ setVisibility: () => ({}) });
    render(<VisibilityControl id="a1" visibility="public" client={client} />);
    expect(screen.getByText(/dejará de verse/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Hacer privado' }));
    expect(calls[0]?.payload).toEqual({ id: 'a1', visibility: 'private' });
  });

  it('RF-13 (001): si la op falla muestra el mensaje y vuelve a habilitar el botón', async () => {
    const { client } = fakeClient({
      setVisibility: () => {
        throw new ApiClientError('forbidden');
      },
    });
    render(<VisibilityControl id="a1" visibility="private" client={client} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hacer público' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No tienes permiso');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Hacer público' }) as HTMLButtonElement).disabled).toBe(false));
  });
});

describe('VisibilityControl · bloques (002)', () => {
  it('RF-6 (002) · 6.3: «Hacer privado» y «Hacer público» son secundarias: la 001 no les pide confirmación ni motivo', () => {
    const { client } = fakeClient({});
    const first = render(<VisibilityControl id="a1" visibility="public" client={client} />);
    expect(screen.getByRole('button', { name: 'Hacer privado' }).classList.contains('action-secondary')).toBe(true);
    expectBlocks(first.container);
    first.unmount();
    const second = render(<VisibilityControl id="a1" visibility="private" client={client} />);
    expect(screen.getByRole('button', { name: 'Hacer público' }).classList.contains('action-secondary')).toBe(true);
    expectBlocks(second.container);
  });

  it('RF-6 (002) · 6.1: el aviso de éxito y el de error son bloques', async () => {
    const ok = fakeClient({ setVisibility: () => ({}) });
    const first = render(<VisibilityControl id="a1" visibility="private" client={ok.client} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hacer público' }));
    await screen.findByRole('status');
    expectBlocks(first.container);
    first.unmount();
    const bad = fakeClient({
      setVisibility: () => {
        throw new ApiClientError('forbidden');
      },
    });
    const second = render(<VisibilityControl id="a1" visibility="private" client={bad.client} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hacer público' }));
    await screen.findByRole('alert');
    expectBlocks(second.container);
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', () => {
    const { client } = fakeClient({});
    const { container } = render(<VisibilityControl id="a1" visibility="public" client={client} />);
    expectBlocks(container, { nesting: true });
  });
});

describe('VisibilityControl · etiquetas (002)', () => {
  it('RF-13 (002) · 13.1, 13.3: la visibilidad es una etiqueta con el texto de la 001', () => {
    const { client } = fakeClient({});
    const { container, rerender } = render(<VisibilityControl id="a1" visibility="private" client={client} />);
    expect(container.querySelector('.tag[data-condition="visibility"]')?.textContent).toBe('privado');
    rerender(<VisibilityControl id="a1" visibility="public" client={client} />);
    expect(container.querySelector('.tag[data-condition="visibility"]')?.textContent).toBe('público');
  });
});
