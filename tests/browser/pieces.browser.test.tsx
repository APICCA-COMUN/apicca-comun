// Capturas de pieza (T-8.3, RNF-5 (002)): el logo en los dos temas y con colores forzados (RF-1 (002) · 1.4,
// 1.6), el favicon a 16 y 32 px (RF-1 (002) · 1.7), los cinco íconos en monocromo (RF-4 (002) · 4.3), los
// bloques de acción y sus estados (RF-6 (002) · 6.1) y el mapa tintado (RF-8 (002) · 8.1). Las referencias
// viven en `__screenshots__/` con sufijo de plataforma y se versionan solo cuando la persona las aprueba
// (T-8.4). La tolerancia es la de `vitest.config.ts` (D-T12 (002)). La 003 suma las piezas
// nuevas (T-7.5 (003), RNF-2 (003), D-T22 (003)): caminos y nodos, botones de ícono, pie, etiqueta, lote y campo.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page } from 'vitest/browser';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
import { THEMES } from '../../shared/domain/identity';
import { AXES } from '../../shared/domain/apice';
import { Logo } from '../../src/components/Logo';
import { AxisIcon } from '../../src/components/AxisIcon';
import { ApiceMap, type MappedApice } from '../../src/components/ApiceMap';
import { RoadSegment } from '../../src/components/RoadSegment';
import { Node } from '../../src/components/Node';
import { ConditionTag } from '../../src/components/ConditionTag';
import { SiteFooter } from '../../src/components/SiteFooter';

let host: HTMLDivElement | undefined;
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

async function waitFor<T>(find: () => T | null | undefined | false, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

/** Monta la pieza en un marco de ancho fijo, con el fondo del tema, y espera la fuente y las transiciones. */
async function mount(element: ReactElement, theme: string, width = 480): Promise<HTMLDivElement> {
  document.documentElement.dataset['theme'] = theme;
  host = document.createElement('div');
  host.style.cssText = `display: inline-block; width: ${width}px; padding: 16px; background: var(--background);`;
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() => created.render(element));
  await document.fonts.ready;
  await waitFor(() => document.getAnimations().length === 0);
  await parkPointer();
  return host;
}

// La ventana del iframe es más angosta que las piezas; sin esto la captura sale recortada.
beforeAll(async () => {
  await page.viewport(1280, 900);
});

/** Saca el puntero de la ventana: un `:hover` heredado de otra prueba cambiaría la sombra de un botón (RF-9 (002)). */
async function parkPointer() {
  await cdp().send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -1, y: -1 });
}

async function forcedColors(active: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', { features: active ? [{ name: 'forced-colors', value: 'active' }] : [] });
}

afterEach(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
  await forcedColors(false);
  delete document.documentElement.dataset['theme'];
});

describe.each(THEMES)('piezas en el tema %s', (theme) => {
  it('RF-1 (002) · 1.4: captura del logo', async () => {
    const piece = await mount(<Logo />, theme, 320);
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`logo-${theme}`);
  });

  it('RF-1 (002) · 1.6: captura del logo con colores forzados', async () => {
    await forcedColors(true);
    const piece = await mount(<Logo />, theme, 320);
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`logo-forzado-${theme}`);
  });

  it('RF-6 (002) · 6.1: captura de los bloques de acción y sus estados', async () => {
    const piece = await mount(
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="block action-primary">Guardar</button>
        <button type="button" className="block action-secondary">Archivar</button>
        <button type="button" className="block action-destructive">Retirar</button>
        <button type="button" className="block action-primary" disabled>Deshabilitado</button>
        <button type="button" className="block action-secondary" aria-busy="true">Guardando…</button>
        <input className="block" aria-invalid="true" aria-label="Campo con error" defaultValue="Campo con error" />
        <p className="block" role="alert">Aviso de error</p>
        <p className="block block-empty">Sin ápices todavía</p>
      </div>,
      theme,
    );
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`bloques-${theme}`);
  });

  it('RF-8 (002) · 8.1: captura del mapa tintado', async () => {
    const apices: MappedApice[] = [
      { id: 'a', name: 'Huerta del barrio', axes: ['agua', 'alimento'], location: { lat: 4.6, lng: -74.08, precision: 'exact' } },
      { id: 'b', name: 'Radio comunitaria', axes: ['comunicación'], location: { lat: 4.65, lng: -74.05, precision: 'exact' } },
    ];
    const piece = await mount(<ApiceMap apices={apices} />, theme, 640);
    await waitFor(() => piece.querySelector('.leaflet-marker-icon'));
    await waitFor(() => {
      const tiles = [...piece.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
      return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth === 256);
    });
    await expect.element(page.elementLocator(piece.querySelector<HTMLElement>('.leaflet-container')!)).toMatchScreenshot(`mapa-${theme}`);
  });
});

describe.each(THEMES)('piezas de la 003 en el tema %s', (theme) => {
  it('RF-9 (003) · 9.1, 9.2, RNF-2 (003): captura de caminos y nodos', async () => {
    // El tramo no trae tamaño propio: lo toma de su contenedor, como en el inicio y en la constitución.
    const segment = (width: number, height: number, child: ReactElement) => (
      <div style={{ width, height, display: 'grid' }}>{child}</div>
    );
    const piece = await mount(
      <div className="pieza-caminos" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <style>{'.pieza-caminos .road-segment { width: 100%; height: 100%; }'}</style>
        <Node />
        {segment(120, 20, <RoadSegment />)}
        <Node />
        {segment(20, 96, <RoadSegment orientation="vertical" />)}
        <div className="lot" style={{ padding: 16 }}>
          {segment(120, 20, <RoadSegment tone="on-surface" />)}
        </div>
      </div>,
      theme,
    );
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`caminos-${theme}`);
  });

  it('RF-4 (003) · 4.5, RNF-2 (003): captura de los botones de ícono', async () => {
    const piece = await mount(
      <div style={{ display: 'flex', gap: 12 }}>
        {AXES.map((axis) => (
          <button key={axis} type="button" className="block icon-button" aria-label={axis} aria-pressed={axis === 'agua'}>
            <AxisIcon axis={axis} />
          </button>
        ))}
      </div>,
      theme,
    );
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`botones-icono-${theme}`);
  });

  it('RF-6 (003) · 6.1, RNF-2 (003): captura de la etiqueta de condición', async () => {
    const piece = await mount(
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <ConditionTag condition="visibility">Privado</ConditionTag>
        <ConditionTag condition="archived">Archivado</ConditionTag>
        <ConditionTag condition="status">En marcha</ConditionTag>
        <ConditionTag condition="reference">Referencia</ConditionTag>
      </div>,
      theme,
    );
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`etiquetas-${theme}`);
  });

  it('RF-3 (003) · 3.1, 3.2, RF-5 (003) · 5.1, RF-13 (003) · 13.1, RNF-2 (003): captura de un lote con un campo', async () => {
    const piece = await mount(
      <div className="lot lot--access">
        <h2>Entrar</h2>
        {/* La misma forma que `SignInForm`: la etiqueta envuelve al campo y queda encima (RF-5 (003) · 5.2). */}
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            Correo electrónico
            <input className="block" type="email" defaultValue="ana@ejemplo.org" />
          </label>
          <label>
            Contraseña
            <input className="block" type="password" aria-invalid="true" defaultValue="corta" />
          </label>
          <p role="alert" className="block">La contraseña debe tener al menos 8 caracteres.</p>
          <button type="button" className="block action-primary">Entrar</button>
        </form>
      </div>,
      theme,
      520,
    );
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`lote-campo-${theme}`);
  });

  it('RF-8 (003) · 8.1, RNF-2 (003): captura del pie', async () => {
    const piece = await mount(<SiteFooter />, theme, 960);
    await expect.element(page.elementLocator(piece)).toMatchScreenshot(`pie-${theme}`);
  });
});

describe('piezas sin tema', () => {
  it.each([16, 32])('RF-1 (002) · 1.7: captura del favicon a %i px', async (size) => {
    const piece = await mount(<img src="/brand/favicon.svg" width={size} height={size} alt="" style={{ display: 'block' }} />, 'light', size);
    await waitFor(() => piece.querySelector('img')!.complete);
    await expect.element(page.elementLocator(piece.querySelector('img')!)).toMatchScreenshot(`favicon-${size}`);
  });

  it('RF-4 (002) · 4.3: captura de los cinco íconos en monocromo', async () => {
    await forcedColors(true);
    const piece = await mount(
      <div style={{ display: 'flex', gap: 12 }}>
        {AXES.map((axis) => (
          <AxisIcon key={axis} axis={axis} />
        ))}
      </div>,
      'light',
      200,
    );
    await expect.element(page.elementLocator(piece)).toMatchScreenshot('iconos-monocromo');
  });
});
