// Edificio en Chromium real (T-5.5 (002), T-4 (021)): con DPR 1, 1,5, 2 y 3 el dibujo mide exactamente 64·n píxeles CSS
// (RF-7 (002) · 7.2) y es un SVG de formas planas, sin imagen ni pixelado (RF-1 (021) · 1.1, 1.2, RF-2 (021) · 2.1).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { Building } from '../../src/components/Building';

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

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  await cdp().send('Emulation.clearDeviceMetricsOverride');
});

describe.each([1, 1.5, 2, 3])('con DPR %s', (dpr) => {
  it.each([
    [1, 100, 4],
    [2, 300, 2],
    [4, 300, 4],
  ])('RF-7 (002) · 7.2, RF-1 (021) · 1.1, RF-2 (021) · 2.1: con n = %s el lado CSS del dibujo es exactamente 64·n, sin imagen ni pixelado', async (n, width, max) => {
    await cdp().send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: dpr, mobile: false });
    expect(devicePixelRatio).toBe(dpr);
    await mount(
      <div style={{ width: `${width}px` }}>
        <Building axes={['agua', 'cobijo']} stage="en marcha" seed="a1" max={max} />
      </div>,
    );
    const drawing = host.querySelector('svg.building__drawing')!;
    await expect.poll(() => drawing.getBoundingClientRect().width).toBe(64 * n);
    expect(drawing.getBoundingClientRect().height).toBe(64 * n);
    expect(host.querySelector('img, canvas')).toBeNull();
    for (const element of host.querySelectorAll('*')) expect(getComputedStyle(element).imageRendering).not.toBe('pixelated');
  });

  it('RF-3 (021) · 3.1 a 3.3: cada etapa suma una parte que se ve: la base, el cuerpo sobre ella y el techo encima', async () => {
    await cdp().send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: dpr, mobile: false });
    await mount(
      <div style={{ width: '128px' }}>
        <Building axes={['energía']} stage="en marcha" seed="a1" max={2} />
      </div>,
    );
    const top = (selector: string) => host.querySelector(selector)!.getBoundingClientRect().top;
    await expect.poll(() => host.querySelector('.building__roof')!.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(top('.building__roof')).toBeLessThan(top('.building__wall'));
    expect(top('.building__wall')).toBeLessThan(top('.building__base'));
  });
});
