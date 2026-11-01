import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { ListSource } from '../data/apices';
import { emptyListSource, fakeListSource } from '../testing/listDoubles';
import { ArchivedApices } from './ArchivedApices';

function setup(session: SessionState, source: ListSource) {
  render(
    <SessionProvider initial={session}>
      <ArchivedApices source={source} />
    </SessionProvider>,
  );
}

describe('ArchivedApices', () => {
  it('RF-21 (001): la autora pide solo los archivados suyos', async () => {
    const { source, requests } = fakeListSource(2);
    setup({ status: 'person', uid: 'u-ana', role: 'member', username: 'ana' }, source);
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(requests[0]).toMatchObject({ audience: 'archived-own', uid: 'u-ana' });
  });

  it('RF-21 (001): la facilitadora pide todos los archivados', async () => {
    const { source, requests } = fakeListSource(2);
    setup({ status: 'person', uid: 'u-fa', role: 'facilitator', username: 'fa' }, source);
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(requests[0]?.audience).toBe('archived-all');
  });

  it('RF-21 (001): sin archivados lo dice', async () => {
    setup({ status: 'person', uid: 'u-ana', role: 'member', username: 'ana' }, emptyListSource().source);
    expect(await screen.findByText(/No tienes ápices archivados/)).toBeTruthy();
  });

  it('RF-21 (001): un visitante no ve la vista ni consulta nada', () => {
    const { source, fetchPage } = fakeListSource(2);
    setup({ status: 'visitor' }, source);
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeTruthy();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('RF-21 (001): una cuenta suspendida tampoco la ve', () => {
    const { source, fetchPage } = fakeListSource(2);
    setup({ status: 'suspended', uid: 'u-x' }, source);
    expect(screen.queryByRole('article')).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe('ArchivedApices · bloques (002)', () => {
  it('RF-6 (002) · 6.1, 6.5: el estado vacío de la vista es un bloque vacío', async () => {
    setup({ status: 'person', uid: 'u-ana', role: 'member', username: 'ana' }, emptyListSource().source);
    const empty = await screen.findByText(/No tienes ápices archivados/);
    expect(empty.classList.contains('block')).toBe(true);
    expect(empty.classList.contains('block-empty')).toBe(true);
  });

  it('RF-6 (002) · 6.3: los enlaces propios de la página no llevan clase de acción', () => {
    setup({ status: 'visitor' }, fakeListSource(0).source);
    const link = screen.getByRole('link', { name: 'Entrar' });
    expect(link.className).toBe('');
  });

  it('RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1: la lista se presenta dentro de un lote con sus tarjetas como bloques', async () => {
    const { source } = fakeListSource(2);
    setup({ status: 'person', uid: 'u-ana', role: 'member', username: 'ana' }, source);
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    const lot = document.querySelector('.lot');
    expect(lot).not.toBeNull();
    expect(lot?.classList.contains('block')).toBe(false);
    for (const article of articles) {
      expect(lot?.contains(article)).toBe(true);
      expect(article.classList.contains('block')).toBe(true);
    }
  });
});
