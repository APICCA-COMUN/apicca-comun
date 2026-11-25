// «E3 · Celda» · revisión de QA del 24-11-2026 (qa-agy-celda-1), errores de la parte A, en Chromium real: la leyenda a 360 px no
// se pisa y a 1280 px va en una franja; el contorno de foco de las filas de Inicio no se recorta; las zonas tocables miden al
// menos 44 px sin cambiar el dibujo; el Ápice elegido lleva un solo contorno; radios y casillas son cuadrados de radio 0 con
// una marca maciza cuando están marcados. Las zonas tocables se miden con `elementFromPoint`: el pseudo-elemento transparente
// que las agranda no sale en `getBoundingClientRect`, pero sí recibe el puntero.
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
import '../../src/components/SiteHeader.css';
import '../../src/pages/Documentation.css';
import { SessionProvider, type SessionState } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import { GameMap, type MapPath } from '../../src/map/GameMap';
import { Play } from '../../src/pages/Play';
import { listed } from '../../src/testing/listDoubles';
import type { Location } from '../../shared/domain/location';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const ITEMS: ListedApice[] = [1, 2, 3].map((n) => listed(n));
const MIN = 44;

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

async function mount(width: number, height: number, ui: React.ReactElement) {
  await page.viewport(width, height);
  window.localStorage.setItem('apicca:bienvenida', '1');
  history.replaceState(null, '', '/');
  bench = document.createElement('div');
  document.body.append(bench);
  const mounted = createRoot(bench);
  root = mounted;
  await actNow(() => mounted.render(ui));
}

const home = (items: ListedApice[] = ITEMS) => (
  <SessionProvider initial={PERSON}>
    <main className="main--play">
      <Play
        source={{ fetchPage: async () => ({ items, cursor: null }) }}
        actionSource={{ list: async () => [], get: async () => null }}
        noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
      />
    </main>
  </SessionProvider>
);

afterEach(async () => {
  window.localStorage.removeItem('apicca:bienvenida');
  if (root !== undefined) await actNow(() => root!.unmount());
  root = undefined;
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

/** Alto tocable de un elemento: cuántos píxeles en vertical, desde el centro, siguen apuntando a él o a algo suyo. */
function hitHeight(element: Element): number {
  const rect = element.getBoundingClientRect();
  const x = rect.left + Math.min(rect.width / 2, 8);
  const center = rect.top + rect.height / 2;
  const own = (y: number): boolean => {
    const at = document.elementFromPoint(x, y);
    return at !== null && (at === element || element.contains(at));
  };
  let up = 0;
  while (up < 80 && own(center - up - 1)) up += 1;
  let down = 0;
  while (down < 80 && own(center + down)) down += 1;
  return up + down;
}

describe('QA celda 1 · 2: la leyenda-control', () => {
  it('a 360 px ningún nombre se pisa con otro y cada texto cae dentro de su caja de 48 px', async () => {
    await mount(360, 800, home());
    await expect.poll(() => bench!.querySelector('.leyenda-control__boton')).toBeTruthy();
    const names = [...bench!.querySelectorAll<HTMLElement>('.leyenda-control__nombre')];
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const name of names) {
      const button = name.closest('button')!.getBoundingClientRect();
      const text = name.getBoundingClientRect();
      expect(text.top, name.textContent ?? '').toBeGreaterThanOrEqual(button.top - 0.5);
      expect(text.bottom, name.textContent ?? '').toBeLessThanOrEqual(button.bottom + 0.5);
    }
    const rects = names.map((name) => name.getBoundingClientRect());
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const overlap = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        expect(overlap, `${names[i]!.textContent} con ${names[rects.indexOf(b)]!.textContent}`).toBe(false);
      }
    }
  });

  it('a 1280 px los nombres de la leyenda tampoco se tocan (las Etapas van en mayúsculas)', async () => {
    await mount(1280, 800, home());
    await expect.poll(() => bench!.querySelector('.leyenda-control__boton')).toBeTruthy();
    const names = [...bench!.querySelectorAll<HTMLElement>('.leyenda-control__nombre')];
    const rects = names.map((name) => name.getBoundingClientRect());
    for (const [i, a] of rects.entries()) {
      for (const [j, b] of rects.entries()) {
        if (j <= i || Math.abs(a.top - b.top) > 4) continue;
        const gap = Math.max(b.left - a.right, a.left - b.right);
        expect(gap, `${names[i]!.textContent} con ${names[j]!.textContent}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('a 1280 px los tres grupos van en una sola franja', async () => {
    await mount(1280, 800, home());
    await expect.poll(() => bench!.querySelector('.leyenda-control__grupo--nivel')).toBeTruthy();
    const tops = [...bench!.querySelectorAll<HTMLElement>('.leyenda-control__grupo')].map((group) => Math.round(group.getBoundingClientRect().top));
    expect(tops).toHaveLength(3);
    expect(new Set(tops).size).toBe(1);
    const legend = bench!.querySelector<HTMLElement>('.leyenda-control__grupos')!;
    for (const group of bench!.querySelectorAll<HTMLElement>('.leyenda-control__grupo')) {
      expect(group.getBoundingClientRect().right).toBeLessThanOrEqual(legend.getBoundingClientRect().right + 0.5);
    }
  });
});

describe('QA celda 1 · 3: el foco de las filas de Inicio', () => {
  it('el contorno de foco (3 px + 3 px de separación) de la primera y la última fila queda dentro de la lista, sin recortarse', async () => {
    await mount(1280, 800, home());
    await expect.poll(() => bench!.querySelector('.play__rows-list .c-fila')).toBeTruthy();
    const list = bench!.querySelector<HTMLElement>('.play__rows-list')!;
    const rows = [...list.querySelectorAll<HTMLElement>('.c-fila')];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of [rows[0]!, rows.at(-1)!]) {
      await userEvent.tab();
      row.focus();
      expect(row.matches(':focus-visible')).toBe(true);
      const style = getComputedStyle(row);
      const reach = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
      expect(reach).toBeGreaterThanOrEqual(6);
      const box = row.getBoundingClientRect();
      const clip = list.getBoundingClientRect();
      expect(box.top - reach).toBeGreaterThanOrEqual(clip.top - 0.5);
      expect(box.bottom + reach).toBeLessThanOrEqual(clip.bottom + 0.5);
      expect(box.left - reach).toBeGreaterThanOrEqual(clip.left - 0.5);
      expect(box.right + reach).toBeLessThanOrEqual(clip.right + 0.5);
    }
  });

  it('con la lista en Inicio caben al menos tres filas enteras', async () => {
    await mount(1280, 800, home([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => listed(n))));
    await expect.poll(() => bench!.querySelector('.play__rows-list .c-fila')).toBeTruthy();
    const list = bench!.querySelector<HTMLElement>('.play__rows-list')!;
    expect(list.querySelectorAll('.c-fila').length).toBeGreaterThanOrEqual(3);
    expect(list.scrollHeight).toBeLessThanOrEqual(list.clientHeight + 1);
  });
});

describe('QA celda 1 · 4: el Ápice elegido', () => {
  it('lleva un solo contorno, de 4 px en tinta; no queda el doble anillo', async () => {
    await mount(1280, 800, <GameMap items={ITEMS} selectedId="a1" onSelect={() => {}} />);
    await expect.poll(() => bench!.querySelector('.game-map__apice')).toBeTruthy();
    expect(bench!.querySelector('.game-map__ring')).toBeNull();
    const chosen = bench!.querySelector<HTMLElement>('.game-map__apice[aria-pressed="true"]')!;
    expect(chosen).not.toBeNull();
    const hex = chosen.querySelector('.game-map__hex')!;
    expect(Number.parseFloat(getComputedStyle(hex).strokeWidth)).toBe(4);
    const other = bench!.querySelector('.game-map__apice[aria-pressed="false"] .game-map__hex')!;
    expect(Number.parseFloat(getComputedStyle(other).strokeWidth)).toBeLessThan(4);
  });
});

const CENTRO: Location = { lat: 4.597156, lng: -74.08474, precision: 'approximate', zone: { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 } };
const PATH: MapPath = { id: 'c1', title: 'Agua lluvia', closed: false, axis: 'agua', apiceIds: ['a1', 'a2'] };

describe('QA celda 1 · 7: zonas tocables de 44 px', () => {
  it('el rótulo de una Acción Común en el mapa mide 44 px tocables sin salir de su caja visible', async () => {
    const two = [1, 2].map((n) => listed(n, { location: CENTRO }));
    await mount(1280, 800, <GameMap items={two} selectedId={null} onSelect={() => {}} paths={[PATH]} selectedPathId={null} />);
    await expect.poll(() => bench!.querySelector('.game-map__path-label')).toBeTruthy();
    const label = bench!.querySelector<HTMLElement>('.game-map__path-label')!;
    expect(label.getBoundingClientRect().height).toBeLessThan(MIN);
    expect(hitHeight(label)).toBeGreaterThanOrEqual(MIN - 1);
  });

  it('el logo y los enlaces de la cabecera miden 44 px tocables', async () => {
    await mount(1280, 800, home());
    await expect.poll(() => bench!.querySelector('.site-nav__link')).toBeTruthy();
    expect(hitHeight(bench!.querySelector('a.logo')!)).toBeGreaterThanOrEqual(MIN - 1);
    for (const link of bench!.querySelectorAll('.site-nav__link')) expect(hitHeight(link)).toBeGreaterThanOrEqual(MIN - 1);
  });

  it('el enlace suelto `action-secondary` y el del índice de la documentación miden 44 px tocables', async () => {
    await mount(
      1280,
      800,
      <div>
        <p>
          <a href="/constitucion/historial" className="action-secondary">
            Historial general
          </a>
        </p>
        <nav aria-label="Índice" className="documentation__index">
          <ul>
            <li>
              <a href="/documentacion/uno">Uno</a>
            </li>
            <li>
              <a href="/documentacion/dos">Dos</a>
            </li>
          </ul>
        </nav>
      </div>,
    );
    expect(hitHeight(bench!.querySelector('a.action-secondary')!)).toBeGreaterThanOrEqual(MIN - 1);
    for (const link of bench!.querySelectorAll('.documentation__index a')) expect(hitHeight(link)).toBeGreaterThanOrEqual(MIN - 1);
  });
});

describe('QA celda 1 · 12: radios y casillas', () => {
  it('son cuadrados de radio 0 con contorno de tinta de 2 px; marcados, llevan una marca maciza de tinta', async () => {
    await mount(
      1280,
      800,
      <form>
        <label>
          <input type="radio" name="r" className="choice" defaultChecked />
          Marcado
        </label>
        <label>
          <input type="radio" name="r" className="choice" />
          Sin marcar
        </label>
        <label>
          <input type="checkbox" defaultChecked />
          Casilla marcada
        </label>
        <label>
          <input type="checkbox" />
          Casilla sin marcar
        </label>
      </form>,
    );
    const inputs = [...bench!.querySelectorAll<HTMLInputElement>('input')];
    const ink = getComputedStyle(document.body).color;
    for (const input of inputs) {
      const style = getComputedStyle(input);
      expect(style.appearance, input.outerHTML).toBe('none');
      expect(style.borderTopLeftRadius).toBe('0px');
      expect(style.borderTopWidth).toBe('2px');
      expect(style.borderTopColor).toBe(ink);
      expect(input.getBoundingClientRect().width).toBeGreaterThanOrEqual(18);
      expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(18);
      if (input.checked) {
        expect(style.backgroundColor).toBe(ink);
        expect(style.backgroundClip).toBe('content-box');
      } else {
        expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      }
    }
  });

  it('con el teclado el foco se ve, con el contorno de 3 px del sistema', async () => {
    await mount(1280, 800, <input type="radio" className="choice" aria-label="Uno" />);
    await userEvent.tab();
    const radio = bench!.querySelector<HTMLInputElement>('input')!;
    expect(document.activeElement).toBe(radio);
    const style = getComputedStyle(radio);
    expect(style.outlineStyle).toBe('solid');
    expect(Number.parseFloat(style.outlineWidth)).toBe(3);
  });
});
