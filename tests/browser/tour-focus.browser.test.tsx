// RF-3 (024) · 3.1 a 3.4, D-T3 (024), D-12 (024) · El recorrido de bienvenida mueve el mapa en Chromium real, en una ventana ancha y en
// un teléfono, con el sistema «APICCA · Mapa»: en el paso del Ápice hay una celda con su nombre dentro del lienzo y fuera de la
// tarjeta; en el paso de la Acción Común, su rótulo está a la vista; y el nivel más alejado de la leyenda deshace el movimiento y vuelve al grupo lejano.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
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
import type { Location } from '../../shared/domain/location';
import { SessionProvider, type SessionState } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import type { CommonActionSource, CommonActionSummary } from '../../src/data/commonActions';
import { NO_NOTICE } from '../../src/data/constitution/notice';
import { Play } from '../../src/pages/Play';
import { listed } from '../../src/testing/listDoubles';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };

const zone = (cell: string, lat: number, lng: number): Location => ({ lat, lng, precision: 'approximate', zone: { cell, lat, lng } });
const CENTRO = zone('8766e092affffff', 4.597156, -74.08474);
const CHAPINERO = zone('8766e42d2ffffff', 4.649886, -74.060244);
const MEDELLIN = zone('876619d92ffffff', 6.243305, -75.585547);
/** Tres Ápices en el centro de Bogotá, uno en Chapinero y otro en Medellín: al abrir, el mapa los reúne en grupos. */
const ITEMS: ListedApice[] = [
  listed(1, { location: CENTRO, name: 'Huerta del barrio' }),
  listed(2, { location: CENTRO, name: 'Compost común' }),
  listed(3, { location: CENTRO, name: 'Agua de lluvia' }),
  listed(4, { location: CHAPINERO, name: 'Vivero' }),
  listed(5, { location: MEDELLIN, name: 'Semillas' }),
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
const actionSource: CommonActionSource = { list: async () => [road], get: async () => null };

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
  window.localStorage.removeItem('apicca:bienvenida');
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
            actionSource={actionSource}
            noticeSource={{ fetchNotice: async () => NO_NOTICE }}
            noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
          />
        </main>
      </SessionProvider>,
    ),
  );
  await expect.poll(() => bench!.querySelector('.game-map[data-level="2"]')).toBeTruthy();
  await expect.poll(() => bench!.querySelector('.welcome-card')).toBeTruthy();
}

/** Empieza el recorrido y espera sus tres pasos: el del Ápice, el de la Acción Común y el de prototipar (las Acciones Comunes llegan después del mapa). */
async function startTour() {
  await userEvent.click(named('Ver el recorrido'));
  await expect.poll(() => bench!.querySelector('.welcome-card__step')?.textContent).toBe('Paso 1 de 3');
}

afterEach(async () => {
  window.localStorage.removeItem('apicca:bienvenida');
  if (root !== undefined) await actNow(() => root!.unmount());
  root = undefined;
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

const canvas = () => bench!.querySelector<HTMLElement>('.game-map')!.getBoundingClientRect();
const card = () => bench!.querySelector<HTMLElement>('.welcome-card')!.getBoundingClientRect();
const inside = (inner: DOMRect, outer: DOMRect) =>
  inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
const apart = (a: DOMRect, b: DOMRect) => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
const named = (label: string) => page.getByRole('button', { name: label });

describe.each([
  [1280, 800],
  [390, 844],
  [360, 800],
])('el recorrido mueve el mapa a %i × %i', (width, height) => {
  beforeEach(async () => {
    await open(width, height);
  });

  // D-12 (024): la tarjeta del recorrido va en el panel, fuera del mapa (a la derecha o debajo), así que no tapa lo que nombra el
  // paso; la misma exigencia vale a 1280 × 800 y en los teléfonos.
  it('RF-3 (024) · 3.1: en el paso del Ápice, una celda con su nombre queda dentro del lienzo y fuera de la tarjeta (D-12 (024))', async () => {
    await startTour();
    await expect.poll(() => bench!.querySelector('.game-map')?.getAttribute('data-level')).toBe('0');
    await expect.poll(() => bench!.querySelectorAll('.game-map button.game-map__apice').length).toBeGreaterThan(0);
    const map = canvas();
    const tourCard = card();
    // El Ápice del paso queda en el centro del lienzo: la celda más cercana a ese centro es la que se mira.
    const centre = { x: map.left + map.width / 2, y: map.top + map.height / 2 };
    const targets = [...bench!.querySelectorAll<HTMLElement>('.game-map button.game-map__apice')];
    const target = targets.sort((a, b) => {
      const da = a.getBoundingClientRect();
      const db = b.getBoundingClientRect();
      return Math.hypot(da.left + da.width / 2 - centre.x, da.top + da.height / 2 - centre.y) - Math.hypot(db.left + db.width / 2 - centre.x, db.top + db.height / 2 - centre.y);
    })[0]!;
    const box = target.getBoundingClientRect();
    expect(inside(box, map)).toBe(true);
    expect(apart(box, tourCard)).toBe(true);
    // El nombre aparece al apuntar la celda (fuera de ella, con papel de fondo) y también queda dentro del lienzo.
    await userEvent.hover(target.querySelector('.game-map__hex')!);
    const label = target.querySelector<HTMLElement>('.game-map__tag')!;
    expect(label.textContent!.length).toBeGreaterThan(0);
    // Apuntar la celda desplaza la página hasta ella: el lienzo y la tarjeta se miden de nuevo, en el mismo desplazamiento.
    expect(inside(label.getBoundingClientRect(), canvas())).toBe(true);
    expect(apart(label.getBoundingClientRect(), card())).toBe(true);
  });

  it('RF-3 (024) · 3.2: en el paso de la Acción Común, su rótulo queda a la vista', async () => {
    await startTour();
    await userEvent.click(named('Siguiente'));
    const find = () => bench!.querySelector<HTMLElement>('.game-map button.game-map__path-label');
    await expect.poll(find).toBeTruthy();
    const label = find()!.getBoundingClientRect();
    expect(inside(label, canvas())).toBe(true);
    // D-12 (024): el rótulo de la Acción Común tampoco queda bajo la tarjeta.
    expect(apart(label, card())).toBe(true);
  });

  // «E3 · Celda»: Inicio ya no muestra los botones del mapa (Acercar, Alejar, Ver todo); el nivel lo elige la leyenda-control, y
  // su nivel más alejado es el que reúne todo en el grupo lejano.
  it('RF-3 (024): el nivel más alejado de la leyenda deshace el movimiento y vuelve al grupo lejano', async () => {
    await startTour();
    await expect.poll(() => bench!.querySelector('.game-map')?.getAttribute('data-level')).toBe('0');
    expect(bench!.querySelector('.game-map__controls')).toBeNull();
    await userEvent.click(named('Nivel 2, el más alejado'));
    await expect.poll(() => bench!.querySelector('.game-map')?.getAttribute('data-level')).toBe('2');
  });
});
