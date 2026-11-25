// RF-10 (024) · 10.1 a 10.4, D-T13 (024) · Inicio en un teléfono, en Chromium real, con el diseño «APICCA · Mapa»: con los filtros
// cerrados, sin panel y con una propuesta abierta, el mapa va arriba y ocupa al menos el 60 % del alto de la ventana; el panel
// va debajo, a todo el ancho, y la página se desplaza. El aviso, con número, fecha larga y enlace, queda dentro del ancho de
// la ventana (y, al llegar a él, dentro de su alto) sin desbordarla. Los botones y enlaces del panel conservan sus 44 px de
// alto (RF-2 (008) · 2.2). Ya no hay barra de herramientas sobre el mapa (se quitó con el rediseño): no se exige su tope de alto.
// Por debajo de 500 px de alto no se exige nada (el escenario deja de estar fijo).
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
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
  [390, 844],
  [360, 800],
])('Inicio en un teléfono a %i × %i', (width, height) => {
  it('RF-10 (024) · 10.1, 10.2: el mapa ocupa al menos el 60 % del alto y el panel va debajo, a todo el ancho', async () => {
    await open(width, height);
    const map = box('.game-map');
    expect(map.height).toBeGreaterThanOrEqual(window.innerHeight * 0.6);
    const panel = box('.play__panel');
    expect(panel.top).toBeGreaterThanOrEqual(map.bottom - 1);
    expect(panel.width).toBeGreaterThanOrEqual(window.innerWidth - 1);
  });

  it('RF-10 (024): el aviso, con número, fecha larga y enlace, queda dentro de la ventana sin desbordarla', async () => {
    await open(width, height);
    const notice = bench!.querySelector<HTMLElement>('.amendment-notice')!;
    expect(notice.textContent).toContain('12 propuestas');
    expect(notice.textContent).toContain(WORST_DATE);
    expect(notice.querySelector('a')?.textContent).toBe('Ver propuestas');
    // El aviso está en el panel, debajo del mapa: se llega a él con el desplazamiento de la página.
    notice.scrollIntoView({ block: 'end' });
    const rect = notice.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
    // El alto del escenario es fraccionario y el desplazamiento de la página, entero: hasta 1 px de diferencia.
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    const link = notice.querySelector('a')!.getBoundingClientRect();
    expect(link.right).toBeLessThanOrEqual(window.innerWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it('RF-10 (024), RF-2 (008) · 2.2: los botones y enlaces del panel conservan los 44 px de alto', async () => {
    await open(width, height);
    const controls = [...bench!.querySelectorAll<HTMLElement>('.play__home button, .play__home a.block')].filter((control) => control.getBoundingClientRect().height > 0);
    // «Lo mío», «Ver como lista» y «Ver propuestas»: la leyenda-control ya no vive en el panel y los filtros se quitaron.
    expect(controls.length).toBeGreaterThanOrEqual(3);
    for (const control of controls) {
      // El sistema da 44 px a los controles del panel (`--size-icon-control`) y 48 px a las acciones (`--size-control`).
      const wanted = 43.5;
      const name = control.textContent || control.getAttribute('aria-label') || control.className;
      expect(control.getBoundingClientRect().height, name).toBeGreaterThanOrEqual(wanted);
    }
  });
});
