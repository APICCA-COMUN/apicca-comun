// «E3 · Celda» · segunda revisión de QA del 24-11-2026 (qa-agy-celda-2), errores de la parte B, en Chromium real:
// 1. el diálogo «Ápices de esta zona» a 360 px deja pasar de línea los nombres largos, sin desbordar y con la celda arriba;
// 2. en «Conectar» los Ápices marcados conservan el color y llevan el contorno de 4 px; con alguno marcado el resto se apaga,
//    y con ninguno no se apaga nada (celda.md, regla 4);
// 4. el aviso de cambios sin guardar se lleva a la vista y recibe el foco, aunque el cuerpo del panel esté desplazado;
// 5. los enlaces sueltos y el índice de la documentación miden al menos 44 px tocables;
// C3. «Conectar» abre el mapa en el nivel cercano (0), donde las celdas se pueden pulsar, aunque alejadas cupieran todas.
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
import '../../src/components/GamePanel.css';
import '../../src/pages/Documentation.css';
import '../../src/pages/Login.css';
import { SessionProvider, VISITOR, type SessionState } from '../../src/app/session';
import type { ListedApice } from '../../src/data/apices';
import { GamePanel } from '../../src/components/GamePanel';
import { GameMap } from '../../src/map/GameMap';
import { LoginPage } from '../../src/pages/Login';
import { NotFound } from '../../src/pages/NotFound';
import { Play } from '../../src/pages/Play';
import { RegisterInfoPage } from '../../src/pages/RegisterInfoPage';
import { listed } from '../../src/testing/listDoubles';
import type { Location } from '../../shared/domain/location';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const MIN = 44;

const BOGOTA: Location = { lat: 4.597156, lng: -74.08474, precision: 'approximate', zone: { cell: '8766e092affffff', lat: 4.597156, lng: -74.08474 } };
const MEDELLIN: Location = { lat: 6.243305, lng: -75.585547, precision: 'approximate', zone: { cell: '876619d92ffffff', lat: 6.243305, lng: -75.585547 } };
const CALI: Location = { lat: 3.445732, lng: -76.532889, precision: 'approximate', zone: { cell: '8766f1c53ffffff', lat: 3.445732, lng: -76.532889 } };

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

async function mount(width: number, height: number, ui: React.ReactElement, path = '/') {
  await page.viewport(width, height);
  window.localStorage.setItem('apicca:bienvenida', '1');
  history.replaceState(null, '', path);
  bench = document.createElement('div');
  document.body.append(bench);
  const mounted = createRoot(bench);
  root = mounted;
  await actNow(() => mounted.render(ui));
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

const NAMES = ['Filtro de agua para la olla común', 'Radio comunitaria La Candelaria', 'Paneles solares de la casa cultural'];
/** Nueve Ápices en una zona: seis con celda y un «+3» que reúne el resto. */
const crowded = (): ListedApice[] =>
  Array.from({ length: 9 }, (_, i) => listed(i + 1, { location: BOGOTA, name: NAMES[i % NAMES.length]! + (i < 3 ? '' : ` ${i}`) }));

describe('QA celda 2 · 1: el diálogo «Ápices de esta zona»', () => {
  it('a 360 px los nombres largos pasan de línea, sin cortarse ni desbordar, con la celda alineada arriba', async () => {
    await mount(360, 800, <GameMap items={crowded()} selectedId={null} onSelect={() => {}} />);
    await expect.poll(() => bench!.querySelector('.game-map__more')).toBeTruthy();
    await userEvent.click(bench!.querySelector<HTMLElement>('.game-map__more')!);
    await expect.poll(() => document.querySelector('.game-map__dialog[open] .game-map__entry')).toBeTruthy();
    const entries = [...document.querySelectorAll<HTMLElement>('.game-map__dialog .game-map__entry')];
    expect(entries.length).toBe(9);
    let wrapped = 0;
    for (const entry of entries) {
      const style = getComputedStyle(entry);
      expect(style.whiteSpace, entry.textContent ?? '').toBe('normal');
      const box = entry.getBoundingClientRect();
      const name = entry.querySelector<HTMLElement>('.game-map__entry-name')!;
      const text = name.getBoundingClientRect();
      expect(text.right, name.textContent ?? '').toBeLessThanOrEqual(box.right + 0.5);
      expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1);
      expect(entry.scrollWidth).toBeLessThanOrEqual(entry.clientWidth + 1);
      if (text.height > Number.parseFloat(getComputedStyle(name).lineHeight) * 1.5) wrapped += 1;
      const cell = entry.querySelector<HTMLElement>('.celda-superficie')!.getBoundingClientRect();
      expect(cell.top - box.top, 'la celda va arriba').toBeLessThanOrEqual(14);
    }
    expect(wrapped, 'al menos un nombre pasa a una segunda línea').toBeGreaterThanOrEqual(1);
    const dialog = document.querySelector<HTMLElement>('.game-map__dialog')!;
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);
  });
});

describe('QA celda 2 · 2: los Ápices marcados en «Conectar»', () => {
  const three = () => [1, 2, 3].map((n) => listed(n, { location: BOGOTA }));
  const apices = () => [...bench!.querySelectorAll<HTMLElement>('.game-map__apice')];

  it('con dos marcados, los demás se apagan (trama) y los marcados llevan contorno de tinta de 4 px y lo dicen sin color', async () => {
    await mount(1280, 800, <GameMap items={three()} selectedId={null} onSelect={() => {}} chosenIds={new Set(['a1', 'a2'])} />);
    await expect.poll(() => apices().length).toBe(3);
    const on = apices().filter((c) => c.getAttribute('aria-pressed') === 'true');
    const off = apices().filter((c) => c.getAttribute('aria-pressed') === 'false');
    expect(on).toHaveLength(2);
    expect(off).toHaveLength(1);
    const ink = getComputedStyle(document.body).color;
    for (const c of on) {
      expect(c.getAttribute('data-off')).toBeNull();
      expect(c.getAttribute('aria-description')).toBe('Elegido para la Acción Común');
      const hex = getComputedStyle(c.querySelector('.game-map__hex')!);
      expect(Number.parseFloat(hex.strokeWidth)).toBe(4);
      expect(hex.stroke).toBe(ink);
    }
    for (const c of off) {
      expect(c.getAttribute('data-off')).toBe('true');
      expect(c.getAttribute('aria-description')).toBe('Sin relación con lo elegido');
      const hex = getComputedStyle(c.querySelector('.game-map__hex')!);
      expect(Number.parseFloat(hex.strokeWidth)).toBeLessThan(4);
      expect(hex.stroke, 'el contorno apagado no es de tinta').not.toBe(ink);
    }
    expect(bench!.querySelector('.game-map')!.getAttribute('data-picked')).toBe('true');
  });

  it('con ninguno marcado no se apaga nada', async () => {
    await mount(1280, 800, <GameMap items={three()} selectedId={null} onSelect={() => {}} chosenIds={new Set()} />);
    await expect.poll(() => apices().length).toBe(3);
    expect(apices().every((c) => c.getAttribute('data-off') === null && c.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(bench!.querySelector('.game-map')!.getAttribute('data-picked')).toBeNull();
  });

  it('al marcar y desmarcar, el apagado va y viene', async () => {
    function Probe() {
      const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
      return <GameMap items={three()} selectedId={null} onSelect={(id) => setChosen(chosen.has(id) ? new Set() : new Set([id]))} chosenIds={chosen} />;
    }
    await mount(1280, 800, <Probe />);
    await expect.poll(() => apices().length).toBe(3);
    await userEvent.click(apices()[0]!);
    await expect.poll(() => apices().filter((c) => c.getAttribute('data-off') === 'true').length).toBe(2);
    await userEvent.click(apices()[0]!);
    await expect.poll(() => apices().filter((c) => c.getAttribute('data-off') === 'true').length).toBe(0);
  });
});

describe('QA celda 2 · 4: el aviso de cambios sin guardar', () => {
  it('al aparecer, el cuerpo desplazado vuelve a mostrarlo y el foco pasa a él; al irse, el foco vuelve a «Cerrar»', async () => {
    function Probe() {
      const [asking, setAsking] = useState(false);
      return (
        <div style={{ blockSize: 360, display: 'flex', flexDirection: 'column' }}>
          <GamePanel
            label="Editar ápice"
            onClose={() => setAsking(true)}
            notice={
              asking && (
                <div role="alert" className="block">
                  <p>Tienes cambios sin guardar. ¿Quieres descartarlos?</p>
                  <button type="button" className="block action-secondary" onClick={() => setAsking(false)}>
                    Seguir editando
                  </button>
                </div>
              )
            }
          >
            <div style={{ blockSize: 1600 }}>
              <h1>Editar ápice</h1>
            </div>
          </GamePanel>
        </div>
      );
    }
    await mount(1280, 800, <Probe />);
    const body = bench!.querySelector<HTMLElement>('.game-panel__body')!;
    body.scrollTop = 500;
    expect(body.scrollTop).toBeGreaterThan(100);
    await userEvent.click(bench!.querySelector<HTMLElement>('.game-panel__close')!);
    await expect.poll(() => bench!.querySelector('[role="alert"]')).toBeTruthy();
    const alert = bench!.querySelector<HTMLElement>('[role="alert"]')!;
    await expect.poll(() => body.scrollTop).toBe(0);
    const area = body.getBoundingClientRect();
    expect(alert.getBoundingClientRect().top).toBeGreaterThanOrEqual(area.top - 0.5);
    expect(alert.getBoundingClientRect().bottom).toBeLessThanOrEqual(area.bottom + 0.5);
    expect(bench!.querySelector('.game-panel__notice')!.contains(document.activeElement)).toBe(true);
    await userEvent.click(bench!.querySelector<HTMLElement>('[role="alert"] button')!);
    await expect.poll(() => bench!.querySelector('[role="alert"]')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(bench!.querySelector('.game-panel__close'));
  });
});

describe('QA celda 2 · 5: enlaces sueltos de 44 px', () => {
  it('«Volver al inicio» (404), «Olvidé mi contraseña», «Pide tu inscripción» y «solicita tu inscripción» miden 44 px tocables', async () => {
    await mount(1280, 800, <NotFound />, '/ruta-inexistente');
    expect(hitHeight(bench!.querySelector('a.c-enlace')!)).toBeGreaterThanOrEqual(MIN - 1);
    await actNow(() => root!.unmount());
    root = undefined;
    bench!.remove();
    bench = undefined;

    await mount(
      360,
      800,
      <SessionProvider initial={VISITOR}>
        <LoginPage />
      </SessionProvider>,
      '/entrar',
    );
    for (const name of ['Olvidé mi contraseña', 'Pide tu inscripción']) {
      const link = [...bench!.querySelectorAll('a')].find((a) => a.textContent === name)!;
      expect(link, name).toBeTruthy();
      expect(hitHeight(link), name).toBeGreaterThanOrEqual(MIN - 1);
    }
    await actNow(() => root!.unmount());
    root = undefined;
    bench!.remove();
    bench = undefined;

    await mount(
      360,
      800,
      <SessionProvider initial={VISITOR}>
        <RegisterInfoPage />
      </SessionProvider>,
      '/registro',
    );
    const link = [...bench!.querySelectorAll('a')].find((a) => /solicita tu inscripción/.test(a.textContent ?? ''))!;
    expect(hitHeight(link)).toBeGreaterThanOrEqual(MIN - 1);
  });

  it('el índice de la documentación (también `Ápice` y `Ejes`) y el enlace en frase miden 44 px', async () => {
    await mount(
      360,
      800,
      <div>
        <nav aria-label="Índice" className="documentation__index">
          <ul>
            <li>
              <a href="/documentacion/apice">Ápice</a>
            </li>
            <li>
              <a href="/documentacion/ejes">Ejes</a>
            </li>
          </ul>
        </nav>
        <p>
          Para sumarte, únete a APICCA. <a href="/solicitar" className="enlace-texto">Unirme</a>
        </p>
      </div>,
    );
    for (const link of bench!.querySelectorAll('.documentation__index a')) {
      expect(link.getBoundingClientRect().width, link.textContent ?? '').toBeGreaterThanOrEqual(MIN);
      expect(hitHeight(link), link.textContent ?? '').toBeGreaterThanOrEqual(MIN - 1);
    }
    expect(hitHeight(bench!.querySelector('a.enlace-texto')!)).toBeGreaterThanOrEqual(MIN - 1);
  });
});

describe('QA celda 2 · C3: «Conectar» abre en el nivel cercano', () => {
  const spread = (): ListedApice[] => [
    listed(1, { location: BOGOTA }),
    listed(2, { location: BOGOTA }),
    listed(3, { location: MEDELLIN }),
    listed(4, { location: CALI }),
  ];
  const play = () => (
    <SessionProvider initial={PERSON}>
      <main className="main--play">
        <Play
          source={{ fetchPage: async () => ({ items: spread(), cursor: null }) }}
          actionSource={{ list: async () => [], get: async () => null }}
          noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
        />
      </main>
    </SessionProvider>
  );
  const levelNow = () => bench!.querySelector('.game-map')?.getAttribute('data-level');

  it('Inicio con Ápices repartidos abre alejado, pero /acciones/nueva abre en el nivel 0 con celdas pulsables', async () => {
    await mount(1280, 800, play(), '/');
    await expect.poll(levelNow).not.toBeNull();
    expect(levelNow(), 'Inicio abre en un nivel alejado (premisa de la prueba)').not.toBe('0');
    await actNow(() => root!.unmount());
    root = undefined;
    bench!.remove();
    bench = undefined;

    await mount(1280, 800, play(), '/acciones/nueva');
    await expect.poll(levelNow).toBe('0');
    await expect.poll(() => bench!.querySelectorAll('.game-map__apice').length).toBeGreaterThan(0);
    const reachable = [...bench!.querySelectorAll<HTMLElement>('.game-map__apice')].filter((cell) => {
      const box = cell.getBoundingClientRect();
      const at = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return at !== null && cell.contains(at) && Math.min(box.width, box.height) >= MIN;
    });
    expect(reachable.length, 'a la vista hay celdas de al menos 44 px que reciben el puntero').toBeGreaterThanOrEqual(1);
  });
});
