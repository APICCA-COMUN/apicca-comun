// RF-4 (024) · 4.1, 4.2, D-T5 (024) · Abrir una Acción Común (`/acciones/:id`) encuadra sus Ápices en Chromium real, en una ventana
// ancha y en un teléfono: el rótulo de la Acción Común y la celda de cada Ápice que une quedan dentro del lienzo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
// La entrada de la cuenta (`SessionEntry`) toma sus estilos de la cabecera, que la aplicación siempre carga.
import '../../src/components/SiteHeader.css';
import type { Location } from '../../shared/domain/location';
import { SessionProvider, type SessionState } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import type { CommonActionDetail, CommonActionSource, CommonActionSummary } from '../../src/data/commonActions';
import { NO_NOTICE } from '../../src/data/constitution/notice';
import { Play } from '../../src/pages/Play';
import { listed } from '../../src/testing/listDoubles';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };

const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const MEDELLIN = zone('876619d92ffffff', 6.243305, -75.585547);
/** Tres Ápices en el centro de Bogotá y uno en Medellín: al abrir, el mapa los muestra en grupos, lejos de las celdas de cada uno. */
const ITEMS: ListedApice[] = [
  listed(1, { location: CENTRO, name: 'Huerta del barrio' }),
  listed(2, { location: CENTRO, name: 'Compost común' }),
  listed(3, { location: CENTRO, name: 'Agua de lluvia' }),
  listed(4, { location: MEDELLIN, name: 'Semillas' }),
];

const road: CommonActionSummary = {
  id: 'c1',
  title: 'Ruta del agua',
  description: 'Una descripción larga.',
  axis: null,
  status: 'abierta',
  authorUid: 'u-otra',
  authorUsername: 'otra',
  apiceIds: ['a1', 'a2', 'a3'],
  participantUids: ['u-otra'],
  participantCount: 1,
  createdAt: 1,
};
const detail: CommonActionDetail = { ...road, participants: [{ uid: 'u-otra', username: 'otra' }], apices: [], hiddenApices: 0 };
const actionSource: CommonActionSource = { list: async () => [road], get: async () => detail };

let bench: HTMLDivElement | undefined;
let root: Root | undefined;

async function actNow(run: () => void | Promise<void>) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      await run();
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

async function open(width: number, height: number) {
  await page.viewport(width, height);
  window.localStorage.setItem('apicca:bienvenida', '1');
  history.replaceState(null, '', '/acciones/c1');
  bench = document.createElement('div');
  document.body.append(bench);
  const mounted = createRoot(bench);
  root = mounted;
  await actNow(() =>
    mounted.render(
      <SessionProvider initial={PERSON}>
        <main className="main--play">
          <Play
            source={{ fetchPage: async () => ({ items: ITEMS, cursor: null }) }}
            actionSource={actionSource}
            noticeSource={{ fetchNotice: async () => NO_NOTICE }}
            noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
          />
        </main>
      </SessionProvider>,
    ),
  );
}

afterEach(async () => {
  window.localStorage.removeItem('apicca:bienvenida');
  if (root !== undefined) await actNow(() => root!.unmount());
  root = undefined;
  bench?.remove();
  bench = undefined;
  history.replaceState(null, '', '/');
  await page.viewport(1280, 800);
});

const canvas = () => bench!.querySelector<HTMLElement>('.game-map')!.getBoundingClientRect();
const inside = (inner: DOMRect, outer: DOMRect) =>
  inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;

describe.each([
  [1280, 800],
  [390, 844],
])('abrir una Acción Común la encuadra a %i × %i', (width, height) => {
  beforeEach(async () => {
    await open(width, height);
  });

  it('RF-4 (024) · 4.1, 4.2: el rótulo de la Acción Común y la celda de cada Ápice que une quedan dentro del lienzo', async () => {
    const label = () => bench!.querySelector<HTMLElement>('.game-map button.game-map__path-label');
    await expect.poll(label).toBeTruthy();
    await expect.poll(() => bench!.querySelector('.game-map')?.getAttribute('data-level')).toBe('0');
    const map = canvas();
    const rects = () => JSON.stringify({ label: label()!.getBoundingClientRect(), map });
    expect(inside(label()!.getBoundingClientRect(), map), rects()).toBe(true);
    for (const name of ['Huerta del barrio', 'Compost común', 'Agua de lluvia']) {
      const cell = bench!.querySelector<HTMLElement>(`.game-map button.game-map__apice[aria-label^="${name}, "]`);
      expect(cell, name).toBeTruthy();
      expect(inside(cell!.getBoundingClientRect(), map), name).toBe(true);
    }
  });
});
