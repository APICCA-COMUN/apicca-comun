// RF-10 (024) · 10.1 a 10.4, D-T13 (024) · La barra del mapa en un teléfono, en Chromium real: con los filtros cerrados, sin panel
// y con una propuesta abierta, el mapa ocupa al menos el 60 % del alto de la ventana y el aviso, con número, fecha y enlace,
// queda dentro de la ventana sin desbordarla. A 390 × 844 la barra mide 338 px o menos y a 360 × 800, 320 px o menos. Los
// controles conservan su alto de 44 px (RF-2 (008) · 2.2). Por debajo de 500 px de alto no se exige nada (el escenario deja de estar fijo).
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
// La entrada de la cuenta (`SessionEntry`) toma sus estilos de la cabecera, que la aplicación siempre carga.
import '../../src/components/SiteHeader.css';
import { SessionProvider, type SessionState } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import type { AmendmentNotice } from '../../src/data/constitution/notice';
import { Play } from '../../src/pages/Play';
import { listed } from '../../src/testing/listDoubles';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const ITEMS: ListedApice[] = [1, 2, 3].map((n) => listed(n));

/** La fecha más larga que puede mostrar el aviso, escrita a mano: «30 de septiembre de 2026» (RF-10 (024)). */
const WORST_DATE = '30 de septiembre de 2026';
const WORST_AT = Date.parse('2026-09-30T12:00:00-05:00');
const NOTICE: AmendmentNotice = { count: 12, nextCloseAt: WORST_AT };

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
  history.replaceState(null, '', '/');
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
            actionSource={{ list: async () => [], get: async () => null }}
            noticeSource={{ fetchNotice: async () => NOTICE }}
            noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
          />
        </main>
      </SessionProvider>,
    ),
  );
  await expect.poll(() => bench!.querySelector('.amendment-notice')).toBeTruthy();
  await expect.poll(() => bench!.querySelector('.game-map')).toBeTruthy();
}

afterEach(async () => {
  window.localStorage.removeItem('apicca:bienvenida');
  if (root !== undefined) await actNow(() => root!.unmount());
  root = undefined;
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

const box = (selector: string) => bench!.querySelector<HTMLElement>(selector)!.getBoundingClientRect();

describe.each([
  [390, 844, 338],
  [360, 800, 320],
])('la barra del mapa a %i × %i', (width, height, barMax) => {
  it('RF-10 (024) · 10.1, 10.2: el mapa ocupa al menos el 60 % del alto y la barra no pasa del tope', async () => {
    await open(width, height);
    expect(box('.game-map').height).toBeGreaterThanOrEqual(window.innerHeight * 0.6);
    expect(box('.play__hud').height).toBeLessThanOrEqual(barMax);
  });

  it('RF-10 (024): el aviso, con número, fecha larga y enlace, queda dentro de la ventana sin desbordarla', async () => {
    await open(width, height);
    const notice = bench!.querySelector<HTMLElement>('.amendment-notice')!;
    expect(notice.textContent).toContain('12 propuestas');
    expect(notice.textContent).toContain(WORST_DATE);
    expect(notice.querySelector('a')?.textContent).toBe('Ver propuestas');
    const rect = notice.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    const link = notice.querySelector('a')!.getBoundingClientRect();
    expect(link.right).toBeLessThanOrEqual(window.innerWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('RF-10 (024), RF-2 (008) · 2.2: los botones y enlaces de la barra conservan los 44 px de alto que ya tenían', async () => {
    await open(width, height);
    const controls = [...bench!.querySelectorAll<HTMLElement>('.play__hud button, .play__hud a.block')].filter((control) => control.getBoundingClientRect().height > 0);
    expect(controls.length).toBeGreaterThan(3);
    for (const control of controls) {
      // La barra ya usa `--size-icon-control` (44 px) en todos sus controles; D-T13 (024) pide que no se reduzcan (RF-2 (008) · 2.2).
      const wanted = 43.5;
      const name = control.textContent || control.getAttribute('aria-label') || control.className;
      expect(control.getBoundingClientRect().height, name).toBeGreaterThanOrEqual(wanted);
    }
  });
});
