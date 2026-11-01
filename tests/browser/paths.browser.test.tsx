// RF-9 (003) · 9.1, 9.2, 9.5, D-T9 (003) · Caminos y nodos en Chromium real: trazo de 14 a 16 px con extremos y uniones
// redondeados, `surface` sobre `background` y `line` sobre `surface`; nodo de 18 px con aro de 4 px `charcoal`;
// sin animaciones; con colores forzados el trazo calcula CanvasText o no se muestra.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/paths.css';
import { Node } from '../../src/components/Node';
import { RoadSegment } from '../../src/components/RoadSegment';

let host: HTMLDivElement;
let root: Root;

async function mount(node: React.ReactNode) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => root.render(node));
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

async function forcedColors(active: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', { features: active ? [{ name: 'forced-colors', value: 'active' }] : [] });
}

/** Color calculado de un token, resuelto por un elemento de prueba. */
function tokenColor(token: string, property: 'color' | 'backgroundColor' = 'color') {
  const probe = document.createElement('span');
  probe.style[property] = `var(--${token})`;
  host.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

function scene() {
  return (
    <>
      <div className="scene-background" style={{ background: 'var(--background)' }}>
        <RoadSegment />
        <Node />
      </div>
      <div className="scene-surface" style={{ background: 'var(--surface)' }}>
        <RoadSegment tone="on-surface" />
        <RoadSegment tone="on-surface" orientation="vertical" />
        <Node />
      </div>
    </>
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await forcedColors(false);
  await act(async () => root.unmount());
  host.remove();
});

describe.each(['light', 'dark'] as const)('caminos y nodos en el tema %s (003)', (theme) => {
  beforeEach(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  it('RF-9 (003) · 9.1: el trazo mide de 14 a 16 px y tiene extremos y uniones redondeados', async () => {
    await mount(scene());
    const paths = host.querySelectorAll<SVGPathElement>('.road-segment path');
    expect(paths).toHaveLength(3);
    for (const path of paths) {
      const style = getComputedStyle(path);
      const width = parseFloat(style.strokeWidth);
      expect(width).toBeGreaterThanOrEqual(14);
      expect(width).toBeLessThanOrEqual(16);
      expect(style.strokeLinecap).toBe('round');
      expect(style.strokeLinejoin).toBe('round');
    }
  });

  it('RF-9 (003) · 9.1: el camino es surface sobre background y line sobre surface', async () => {
    await mount(scene());
    const [onBackground] = host.querySelectorAll<SVGPathElement>('.scene-background .road-segment path');
    expect(getComputedStyle(onBackground!).stroke).toBe(tokenColor('surface'));
    for (const path of host.querySelectorAll<SVGPathElement>('.scene-surface .road-segment path')) {
      expect(getComputedStyle(path).stroke).toBe(tokenColor('line'));
    }
  });

  it('RF-9 (003) · 9.2: el nodo es un círculo de 18 px en surface con aro de 4 px charcoal', async () => {
    await mount(scene());
    for (const node of host.querySelectorAll<HTMLElement>('.node')) {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      expect(box.width).toBe(18);
      expect(box.height).toBe(18);
      expect(style.borderTopLeftRadius).toBe('50%');
      expect(style.borderTopWidth).toBe('4px');
      expect(style.borderTopStyle).toBe('solid');
      expect(style.borderTopColor).toBe(tokenColor('charcoal'));
      expect(style.backgroundColor).toBe(tokenColor('surface', 'backgroundColor'));
    }
  });

  it('RF-9 (003) · 9.5: no hay animaciones ni transiciones en caminos y nodos', async () => {
    await mount(scene());
    expect(document.getAnimations()).toEqual([]);
    for (const el of host.querySelectorAll<Element>('.road-segment, .road-segment path, .node')) {
      const style = getComputedStyle(el);
      expect(style.animationName).toBe('none');
      expect(parseFloat(style.transitionDuration)).toBe(0);
    }
  });

  it('RF-9 (003) · 9.1, 9.2: con colores forzados el trazo calcula CanvasText o no se muestra, y el nodo conserva su aro', async () => {
    await forcedColors(true);
    await mount(scene());
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
    const canvasText = (() => {
      const probe = document.createElement('span');
      probe.style.color = 'CanvasText';
      host.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    })();
    for (const path of host.querySelectorAll<SVGPathElement>('.road-segment path')) {
      const style = getComputedStyle(path);
      const hidden = style.display === 'none' || style.visibility === 'hidden';
      expect(hidden || style.stroke === canvasText).toBe(true);
    }
    for (const node of host.querySelectorAll<HTMLElement>('.node')) {
      const style = getComputedStyle(node);
      expect(style.borderTopWidth).toBe('4px');
      expect(style.borderTopStyle).toBe('solid');
      expect(style.borderTopColor).toBe(canvasText);
    }
  });
});
