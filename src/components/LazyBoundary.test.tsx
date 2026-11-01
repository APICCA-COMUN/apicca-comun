// RNF-4 (003); D-T16 (003): carga diferida con «Cargando…», aviso de error y reintento.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectBlocks } from '../testing/expectBlocks';
import { LazyBoundary, lazyPage } from './LazyBoundary';

const Hello = () => <p>Página cargada</p>;

describe('LazyBoundary y lazyPage', () => {
  it('RNF-4 (003) · D-T16 (003): muestra «Cargando…» mientras la página llega y luego la pinta', async () => {
    let release: (m: { default: typeof Hello }) => void = () => {};
    const Page = lazyPage(() => new Promise<{ default: typeof Hello }>((r) => (release = r)));
    render(
      <LazyBoundary>
        <Page />
      </LazyBoundary>,
    );
    expect(screen.getByText('Cargando…')).toBeTruthy();
    release({ default: Hello });
    expect(await screen.findByText('Página cargada')).toBeTruthy();
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('RNF-4 (003) · D-T16 (003): si la carga falla muestra un role="alert" con «Reintentar» que pasa expectBlocks', async () => {
    const Page = lazyPage(() => Promise.reject<{ default: typeof Hello }>(new Error('sin red')));
    const { container } = render(
      <LazyBoundary>
        <Page />
      </LazyBoundary>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Reintentar');
    expect(screen.getByRole('button', { name: 'Reintentar' }).className).toContain('action-secondary');
    expectBlocks(container, { nesting: true });
  });

  it('RNF-4 (003) · D-T16 (003): reintentar vuelve a llamar al import y pinta la página', async () => {
    const loader = vi
      .fn<() => Promise<{ default: typeof Hello }>>()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue({ default: Hello });
    const Page = lazyPage(loader);
    render(
      <LazyBoundary>
        <Page />
      </LazyBoundary>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Página cargada')).toBeTruthy();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
