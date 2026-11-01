import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { NoticesData, NoticesSource } from '../data/notices';
import { fakeClient } from '../testing/facilitationDoubles';
import { expectBlocks } from '../testing/expectBlocks';
import { NoticeBell } from './NoticeBell';

const member: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const notice = (id: string, at: number) => ({ id, type: 'apice-editado' as const, at, href: '/apices/a1', actor: 'beto', subject: 'Huerta' });
const sourceOf = (data: NoticesData): NoticesSource => ({ fetchNotices: async () => data });

const setup = (data: NoticesData, session: SessionState = member, client = fakeClient({ markNoticesSeen: () => ({}) }).client) =>
  render(
    <SessionProvider initial={session}>
      <NoticeBell source={sourceOf(data)} client={client} />
    </SessionProvider>,
  );

describe('NoticeBell', () => {
  it('RF-4 (012) · 4.1: la campana dice cuántos avisos hay sin leer y muestra el contador', async () => {
    setup({ notices: [notice('a', 300), notice('b', 200), notice('c', 100)], seenAt: 150 });
    const bell = await screen.findByRole('button', { name: 'Avisos: tienes 2 sin leer' });
    expect(bell.classList.contains('icon-button')).toBe(true);
    expect(document.querySelector('.notice-bell__count')?.textContent).toBe('2');
    expect(document.querySelector('.notice-bell__count')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('RF-4 (012) · 4.1: sin avisos sin leer no hay número y el nombre lo dice', async () => {
    setup({ notices: [notice('a', 100)], seenAt: 200 });
    await screen.findByRole('button', { name: 'Avisos: no tienes avisos sin leer' });
    expect(document.querySelector('.notice-bell__count')).toBeNull();
  });

  it('RF-4 (012) · 4.2: al activarla se abre el panel con cada aviso y su enlace', async () => {
    const { container } = setup({ notices: [notice('a', 300)], seenAt: null });
    await userEvent.click(await screen.findByRole('button', { name: /^Avisos:/ }));
    const link = screen.getByRole('link', { name: '@beto editó «Huerta»' });
    expect(link.getAttribute('href')).toBe('/apices/a1');
    expect(screen.getByRole('button', { name: 'Marcar como leídos' })).toBeTruthy();
    expectBlocks(container);
  });

  it('RF-5 (012): sin avisos el panel dice «No tienes avisos»', async () => {
    setup({ notices: [], seenAt: null });
    await userEvent.click(await screen.findByRole('button', { name: /^Avisos:/ }));
    expect(screen.getByText('No tienes avisos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcar como leídos' })).toBeNull();
  });

  it('RF-3 (012): «Marcar como leídos» llama a markNoticesSeen', async () => {
    const { client, calls } = fakeClient({ markNoticesSeen: () => ({}) });
    setup({ notices: [notice('a', 300)], seenAt: null }, member, client);
    await userEvent.click(await screen.findByRole('button', { name: /^Avisos:/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como leídos' }));
    expect(calls).toEqual([{ op: 'markNoticesSeen', payload: {} }]);
  });

  it('RF-4 (012): un visitante no ve la campana', () => {
    setup({ notices: [notice('a', 300)], seenAt: null }, { status: 'visitor' } as SessionState);
    expect(screen.queryByRole('button', { name: /^Avisos:/ })).toBeNull();
  });
  it('RF-7 (012): Escape cierra el panel y devuelve el foco a la campana', async () => {
    setup({ notices: [notice('a', 300)], seenAt: null });
    const bell = await screen.findByRole('button', { name: /^Avisos:/ });
    await userEvent.click(bell);
    screen.getByRole('button', { name: 'Marcar como leídos' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Avisos' })).toBeNull();
    expect(bell.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bell);
  });

  it('RF-7 (012) · 7.1: un clic afuera cierra el panel y uno adentro no', async () => {
    render(
      <SessionProvider initial={member}>
        <p>Afuera</p>
        <NoticeBell source={sourceOf({ notices: [notice('a', 300)], seenAt: null })} client={fakeClient({ markNoticesSeen: () => ({}) }).client} />
      </SessionProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /^Avisos:/ }));
    await userEvent.click(screen.getByRole('region', { name: 'Avisos' }));
    expect(screen.getByRole('region', { name: 'Avisos' })).toBeTruthy();
    await userEvent.click(screen.getByText('Afuera'));
    expect(screen.queryByRole('region', { name: 'Avisos' })).toBeNull();
  });
});
