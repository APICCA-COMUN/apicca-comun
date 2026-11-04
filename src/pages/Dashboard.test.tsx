import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionSource, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource, ListSource } from '../data/apices';
import { fakeClient } from '../testing/facilitationDoubles';
import type { NoticeSource } from '../data/constitution/notice';
import { emptyListSource, fakeListSource, listed } from '../testing/listDoubles';
import { expectOnePrimary } from '../testing/expectActions';
import { Dashboard } from './Dashboard';

// Mi tablero (RF-11 (003), D-T13 (003)). El mapa real carga Leaflet; aquí se simula con un botón por ápice con ubicación.
vi.mock('../components/ApiceMap', () => ({
  ApiceMap: ({ apices }: { apices: { id: string; name: string; location: unknown }[] }) => (
    <div aria-label="Mapa de ápices">
      {apices
        .filter((a) => a.location !== null)
        .map((a) => (
          <button key={a.id} type="button">
            Marcador {a.name}
          </button>
        ))}
    </div>
  ),
}));

const member: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const facilitator: SessionState = { status: 'person', uid: 'u-fa', role: 'facilitator', username: 'fabi' };

beforeEach(() => window.history.replaceState(null, '', '/tablero'));

const apiceSource: ApiceSource = {
  onApice(id, callback) {
    const doc: ApiceDoc = { ...listed(Number(id.slice(1))), version: 1, needs: '', offers: '', visibility: 'private', isArchived: false, authorUid: 'u-ana' };
    callback(doc);
    return () => {};
  },
};

function setup(
  session: SessionState,
  source: ListSource = fakeListSource(1).source,
  sessionSource?: SessionSource,
  noticeSource?: NoticeSource,
) {
  return render(
    <SessionProvider {...(sessionSource ? { source: sessionSource } : { initial: session })}>
      <Dashboard source={source} apiceSource={apiceSource} client={fakeClient({}).client} {...(noticeSource ? { noticeSource } : {})} />
    </SessionProvider>,
  );
}

describe('Dashboard · cabecera (T-4.18)', () => {
  it('RF-11 (003) · 11.1: muestra el saludo con el @usuario', async () => {
    setup(member);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toContain('@ana');
  });

  it('RF-11 (003) · 11.10: muestra el rol en texto, «Persona inscrita» o «Facilitador»', () => {
    const first = setup(member);
    expect(screen.getByText('Persona inscrita')).toBeTruthy();
    first.unmount();
    setup(facilitator);
    expect(screen.getByText('Facilitador')).toBeTruthy();
  });

  it('RF-11 (003) · 11.1 y RF-4 (003) · 4.2: «Nuevo ápice» es el único botón azul', () => {
    const { container } = setup(member);
    expectOnePrimary(container, 'Nuevo ápice');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).getAttribute('href')).toBe('/apices/nuevo');
  });

  it('RF-11 (003) · 11.4: «Cerrar sesión» es un botón secundario', () => {
    setup(member);
    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(button.classList.contains('action-secondary')).toBe(true);
    expect(button.classList.contains('action-primary')).toBe(false);
  });

  it('RF-11 (003) · 11.4: enlaza a «Archivados»', () => {
    setup(member);
    expect(screen.getByRole('link', { name: 'Archivados' }).getAttribute('href')).toBe('/archivados');
  });

  it('RF-11 (003) · 11.5: el facilitador ve el enlace a Facilitación y la persona inscrita no', () => {
    const first = setup(facilitator);
    expect(screen.getByRole('link', { name: 'Facilitación' }).getAttribute('href')).toBe('/facilitacion/invitaciones');
    first.unmount();
    setup(member);
    expect(screen.queryByRole('link', { name: 'Facilitación' })).toBeNull();
  });

  it('RF-8 (008) · 8.5, D-10 (008): las secciones van sobre el fondo, sin un lote que las envuelva', () => {
    const { container } = setup(member);
    const root = container.querySelector('.dashboard') as HTMLElement;
    expect(root.classList.contains('lot')).toBe(false);
    expect(root.closest('.lot')).toBeNull();
  });

  it('RF-8 (008) · 8.6, D-10 (008): la fila del saludo lleva «Hola, @usuario» y «Nuevo ápice»', () => {
    const { container } = setup(member);
    const head = container.querySelector('.dashboard__head') as HTMLElement;
    expect(head.querySelector('h1')?.textContent).toBe('Hola, @ana');
    expect(head.querySelector('a[href="/apices/nuevo"]')?.textContent).toBe('Nuevo ápice');
  });

  it('RF-8 (008) · 8.7, 8.8: «Mis ápices» sigue a la fila, y Archivados y Cerrar sesión se conservan', () => {
    setup(member);
    expect(screen.getByRole('heading', { level: 2, name: 'Mis ápices' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Archivados' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});

describe('Dashboard · lista y estados (T-4.19)', () => {
  it('RF-11 (003) · 11.2: pide la lista «mine» con el uid de la persona', async () => {
    const { source, requests } = fakeListSource(2);
    setup(member, source);
    await screen.findByRole('button', { name: 'Ápice 1, Idea' });
    expect(requests[0]?.audience).toBe('mine');
    expect(requests[0]?.uid).toBe('u-ana');
  });

  it('RF-11 (003) · 11.3: muestra la lista con las mismas fichas y enlaces que Prototipado, y el mapa con los mismos ápices', async () => {
    const withPoint = listed(1, { location: { lat: 4.6, lng: -74.1, precision: 'approximate' } });
    const { source } = fakeListSource(2, () => [withPoint, listed(2)]);
    window.history.replaceState(null, '', '/tablero?vista=lista');
    setup(member, source);
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Ápice 1/ }).getAttribute('href')).toBe('/apices/a1');
    await userEvent.click(screen.getByRole('button', { name: 'Ver en el mapa' }));
    expect(await screen.findByRole('button', { name: 'Marcador Ápice 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcador Ápice 2' })).toBeNull();
  });

  it('RF-11 (003) · 11.3: pagina con «Ver más» como la lista de Prototipado', async () => {
    const { source, requests } = fakeListSource(30);
    window.history.replaceState(null, '', '/tablero?vista=lista');
    setup(member, source);
    await screen.findAllByRole('article');
    await userEvent.click(await screen.findByRole('button', { name: /más/i }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]?.audience).toBe('mine');
    expect(requests[1]?.cursor).not.toBeNull();
  });

  it('RF-11 (003) · 11.7: el visitante va a /entrar?volver=%2Ftablero sin dejar /tablero en el historial', async () => {
    const before = window.history.length;
    setup({ status: 'visitor' });
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/entrar?volver=%2Ftablero'));
    expect(window.history.length).toBe(before);
  });

  it('RF-11 (003) · 11.7: con la sesión cargando no redirige', () => {
    setup({ status: 'loading' });
    expect(window.location.pathname).toBe('/tablero');
    expect(screen.queryByRole('link', { name: 'Nuevo ápice' })).toBeNull();
  });

  it('RF-11 (003) · 11.9: con la cuenta suspendida no muestra saludo, rol, «Nuevo ápice» ni lista, y no pide ápices', () => {
    const { source, requests } = fakeListSource(2);
    const { container } = setup({ status: 'suspended', uid: 'u1' }, source);
    expect(container.innerHTML).toBe('');
    expect(requests).toHaveLength(0);
    expect(window.location.pathname).toBe('/tablero');
  });

  it('RF-11 (003) · 11.11: no muestra aviso de propuestas hasta que la 004 lo agregue', () => {
    setup(member);
    expect(screen.queryByText(/propuesta/i)).toBeNull();
  });

  it('RF-11 (003) · 11.4 y D-T13 (003): «Cerrar sesión» navega primero a / y luego cierra la sesión', async () => {
    let pathAtSignOut: string | null = null;
    const signOut = vi.fn(async () => {
      pathAtSignOut = window.location.pathname;
    });
    const sessionSource: SessionSource = {
      onAuth: (cb) => {
        cb('u-ana');
        return () => {};
      },
      onAccount: (_uid, cb) => {
        cb({ email: 'ana@ejemplo.org', name: 'Ana', username: 'ana', role: 'member', status: 'active' });
        return () => {};
      },
      signOut,
    };
    setup(member, fakeListSource(1).source, sessionSource);
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(pathAtSignOut).toBe('/');
  });
});

describe('Dashboard · aviso de propuestas abiertas (T-10.18)', () => {
  it('RF-15 (004) · 15.1: muestra AmendmentNotice cuando hay propuestas abiertas y omite si no las hay', async () => {
    const noticeSource: NoticeSource = {
      fetchNotice: vi.fn().mockResolvedValue({
        count: 2,
        nextCloseAt: Date.parse('2026-10-20T12:00:00Z'),
      }),
    };
    setup(member, fakeListSource(1).source, undefined, noticeSource);
    expect(await screen.findByRole('status', { name: /aviso de propuestas abiertas/i })).toBeTruthy();
    expect(screen.getByText(/Hay 2 propuestas abiertas/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver propuestas' }).getAttribute('href')).toBe('/constitucion/propuestas');
  });

  it('RF-15 (004) · 15.1: si el aviso no se puede leer, Mi tablero sigue sin aviso y sin rechazo suelto', async () => {
    const fetchNotice = vi.fn().mockRejectedValue(new Error('sin red'));
    setup(member, fakeListSource(1).source, undefined, { fetchNotice });
    await screen.findByRole('button', { name: 'Ápice 1, Idea' });
    await waitFor(() => expect(fetchNotice).toHaveBeenCalled());
    await new Promise((done) => setTimeout(done, 0));
    expect(screen.queryByRole('status', { name: /aviso de propuestas abiertas/i })).toBeNull();
  });

  it('RF-15 (004) · 15.1: AmendmentNotice no se importa en ninguna otra página excepto Dashboard y ConstitutionPage', () => {
    const pagesDir = path.resolve(__dirname);
    const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));
    const allowed = new Set(['Dashboard.tsx', 'ConstitutionPage.tsx']);
    for (const file of files) {
      if (allowed.has(file)) continue;
      const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
      expect(content.includes('AmendmentNotice')).toBe(false);
    }
  });
});

describe('Dashboard · RF-9 (005)', () => {
  it('RF-9 (005) · 9.1, RF-6 (019) · 6.1, 6.3, RF-10 (019) · 10.5: «Mis ápices» lleva el terreno de los ápices propios, sin la lista a la vez, y el mapa debajo solo cuando se pide', async () => {
    setup(member, fakeListSource(2).source);
    await screen.findByRole('button', { name: 'Ápice 1, Idea' });
    const heading = screen.getByRole('heading', { level: 2, name: 'Mis ápices' });
    const building = screen.getByRole('button', { name: 'Ápice 1, Idea' });
    expect(heading.compareDocumentPosition(building) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByLabelText('Mapa de ápices')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Ver en el mapa' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(building.compareDocumentPosition(await screen.findByLabelText('Mapa de ápices')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Ápices' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Ápice \d, Idea$/ })).toHaveLength(2);
  });

  it('RF-9 (005) · 9.2: «Nuevo ápice» lleva un «+» decorativo y conserva su nombre', () => {
    setup(member);
    const link = screen.getByRole('link', { name: 'Nuevo ápice' });
    const icon = link.querySelector('svg')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(link.textContent).toBe('Nuevo ápice');
  });

  it('RF-7 (005) · 7.11: con la edición rápida a la vista, «Nuevo ápice» pasa a secundario', async () => {
    setup(member, fakeListSource(2).source);
    await screen.findByRole('button', { name: 'Ápice 1, Idea' });
    await userEvent.click(screen.getByRole('button', { name: 'Ápice 2, Idea' }));
    const panel = screen.getByRole('complementary', { name: 'Ápice elegido' });
    await within(panel).findByRole('button', { name: 'Guardar cambios' });
    expectOnePrimary(document.body, 'Guardar cambios');
  });
});

describe('Dashboard · terreno (019)', () => {
  const lot = () => document.querySelector('.apice-lot');
  const list = () => screen.queryByRole('region', { name: 'Ápices' });

  it('RF-6 (019) · 6.2, 6.3, D-T20 (019): «Ver como lista» muestra la lista con ?vista=lista y «Ver como terreno» vuelve', async () => {
    setup(member, fakeListSource(2).source);
    await screen.findByRole('button', { name: 'Ápice 1, Idea' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(await within(list()!).findAllByRole('article')).toHaveLength(2);
    expect(lot()).toBeNull();
    expect(window.location.pathname).toBe('/tablero');
    expect(new URLSearchParams(window.location.search).get('vista')).toBe('lista');
    await userEvent.click(screen.getByRole('button', { name: 'Ver como terreno' }));
    await waitFor(() => expect(lot()).not.toBeNull());
    expect(list()).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('RF-7 (019) · 7.1, 7.3, D-T20 (019): el contador y el control de vista van en la franja; mientras carga, «Cargando ápices…»', async () => {
    setup(member, { fetchPage: () => new Promise<never>(() => undefined) });
    const strip = document.querySelector('.apice-lot-section__strip') as HTMLElement;
    expect(strip).not.toBeNull();
    expect(within(strip).getByRole('status').textContent).toBe('Cargando ápices…');
    expect(within(strip).getByRole('button', { name: 'Ver como lista' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/no tienes ápices/i);
  });

  it('RF-19 (019) · 19.1 a 19.4, D-T22 (019): sin ápices, solo el terreno de partida con una frase, «Propón tu primer ápice» y «Nuevo ápice» secundario', async () => {
    setup(member, emptyListSource().source);
    const terrain = await screen.findByRole('region', { name: 'Terreno de partida' });
    expect(terrain.querySelectorAll('.starting-terrain__base')).toHaveLength(5);
    expect(screen.getByText('Todavía no tienes ápices en el terreno.')).toBeTruthy();
    expect(screen.getAllByText(/no hay ápices|no tienes ápices/i)).toHaveLength(1);
    const action = screen.getByRole('link', { name: 'Propón tu primer ápice' });
    expect(action.getAttribute('href')).toBe('/apices/nuevo');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).classList.contains('action-secondary')).toBe(true);
    expectOnePrimary(document.body, 'Propón tu primer ápice');
    expect(screen.queryByLabelText('Mapa de ápices')).toBeNull();
    expect(document.querySelector('.apice-lot-section__strip')).toBeNull();
    expect(list()).toBeNull();
  });
});
