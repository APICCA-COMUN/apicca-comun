// RF-11 (024) · 11.1 a 11.3, D-T14 (024) · El nombre a la vista en el panel, en Chromium real: en un teléfono (menos de 900 px) el
// panel va debajo del mapa y, al abrirse, la página baja hasta él; la ficha de un Ápice (`/apices/:id`) y la de una Acción Común
// (`/acciones/:id`) muestran el nombre h1 entero dentro de la ventana, sin desplazar el cuerpo del panel; la superficie de la
// ficha mide cerca de 7rem y va antes del nombre. A 1280 px la columna no cambia.
import { afterEach, describe, expect, it } from 'vitest';
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
import { SessionProvider, type SessionState } from '../../src/app/session';
import type { ApiceDoc, ApiceSource, ListedApice } from '../../src/data/apices';
import type { CommonActionDetail, CommonActionSource, CommonActionSummary } from '../../src/data/commonActions';
import { NO_NOTICE } from '../../src/data/constitution/notice';
import { Play } from '../../src/pages/Play';
import { listed } from '../../src/testing/listDoubles';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };

/** Un nombre largo, de los que ocupan dos o tres líneas en un teléfono (RF-11 (024) · 11.1). */
const LONG_NAME = 'Huerta comunitaria del barrio de las flores y el agua de lluvia';
const ITEMS: ListedApice[] = [1, 2, 3].map((n) => listed(n, { name: n === 1 ? LONG_NAME : `Ápice ${n}` }));
const apiceDoc: ApiceDoc = {
  ...ITEMS[0]!,
  version: 1,
  needs: 'Agua y manos para la huerta.',
  offers: 'Semillas y compost.',
  visibility: 'public',
  isArchived: false,
  authorUid: 'u-otra',
  authorUsername: 'otra',
};
const apiceSource: ApiceSource = {
  onApice: (_id, callback) => {
    callback(apiceDoc);
    return () => undefined;
  },
};

const road: CommonActionSummary = {
  id: 'c1',
  title: 'Ruta comunitaria del agua de lluvia y las huertas del barrio de las flores',
  description: 'Una descripción larga.\n\nCon más de un párrafo para que la hoja se desplace.',
  axis: 'agua',
  status: 'abierta',
  authorUid: 'u-otra',
  authorUsername: 'otra',
  apiceIds: ['a1', 'a2'],
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

async function open(width: number, height: number, path: string) {
  await page.viewport(width, height);
  window.localStorage.setItem('apicca:bienvenida', '1');
  history.replaceState(null, '', path);
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
            apiceSource={apiceSource}
            actionSource={actionSource}
            noticeSource={{ fetchNotice: async () => NO_NOTICE }}
            noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
          />
        </main>
      </SessionProvider>,
    ),
  );
  await expect.poll(() => bench!.querySelector('.game-panel h1')).toBeTruthy();
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

const rectOf = (selector: string) => bench!.querySelector<HTMLElement>(selector)!.getBoundingClientRect();

describe.each([
  [390, 844],
  [360, 800],
])('el nombre en la hoja a %i × %i', (width, height) => {
  for (const [label, path] of [
    ['la ficha de un ápice', '/apices/a1'],
    ['la Acción Común', '/acciones/c1'],
  ] as const) {
    it(`RF-11 (024) · 11.1, 11.2: en ${label}, el h1 queda entero dentro de la ventana, con el panel a la vista y sin desplazar su cuerpo`, async () => {
      await open(width, height, path);
      // El panel va debajo del mapa: al abrirse, la página baja hasta él (un cuadro después).
      await expect.poll(() => rectOf('.game-panel h1').bottom).toBeLessThanOrEqual(window.innerHeight);
      expect(rectOf('.game-panel h1').top).toBeGreaterThanOrEqual(0);
      const body = bench!.querySelector<HTMLElement>('.game-panel__body')!;
      expect(body.scrollTop).toBe(0);
      const visible = body.getBoundingClientRect();
      const name = rectOf('.game-panel h1');
      expect(name.height).toBeGreaterThan(0);
      expect(name.top).toBeGreaterThanOrEqual(visible.top);
      expect(name.bottom).toBeLessThanOrEqual(visible.bottom);
      expect(name.bottom).toBeLessThanOrEqual(window.innerHeight);
    });
  }

  it('RF-11 (024) · 11.1, D-T14 (024): la superficie de la ficha mide cerca de 7rem y va antes del nombre', async () => {
    await open(width, height, '/apices/a1');
    const drawing = rectOf('.apice-view > .superficie');
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(drawing.height).toBeLessThanOrEqual(7 * rem + 1);
    expect(drawing.height).toBeGreaterThan(4 * rem);
    expect(drawing.bottom).toBeLessThanOrEqual(rectOf('.apice-view__head h1').top);
  });

  it('RF-11 (024): en la Acción Común, el estado y el título van al comienzo del panel', async () => {
    await open(width, height, '/acciones/c1');
    const status = rectOf('.common-action__status');
    const title = rectOf('.common-action h1');
    const body = rectOf('.game-panel__body');
    expect(status.top).toBeGreaterThanOrEqual(body.top);
    expect(status.bottom).toBeLessThanOrEqual(title.top + 1);
    expect(title.top - body.top).toBeLessThan(80);
  });
});

describe('el nombre en la columna a 1280 × 800', () => {
  it('RF-11 (024) · 11.1: la ficha no cambia, la superficie conserva su tamaño y el nombre queda a la vista', async () => {
    await open(1280, 800, '/apices/a1');
    const visible = rectOf('.game-panel__body');
    const name = rectOf('.game-panel h1');
    expect(name.top).toBeGreaterThanOrEqual(visible.top);
    expect(name.bottom).toBeLessThanOrEqual(visible.bottom);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(rectOf('.apice-view > .superficie').height).toBeGreaterThan(6 * rem + 1);
  });
});
