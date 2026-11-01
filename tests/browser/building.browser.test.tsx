// Edificio en Chromium real (T-5.5): con DPR 1, 1,5, 2 y 3 la imagen mide exactamente 64·n píxeles CSS
// (RF-7 (002) · 7.2) y se dibuja sin suavizado aunque el navegador redondee (7.3, D-T10 (002)).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { Building } from '../../src/components/Building';
import type { ApiceImage } from '../../src/data/apices';

let host: HTMLDivElement;
let root: Root;

/** Un PNG real de 64 × 64 con un damero, para que el navegador tenga algo que decodificar. */
async function png64(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x += 8) {
    context.fillStyle = (x + y) % 16 === 0 ? '#000' : '#fff';
    context.fillRect(x, y, 8, 8);
  }
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

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
  ])('RF-7 (002) · 7.2, 7.3: con n = %s el lado CSS es exactamente 64·n y la imagen no se suaviza', async (n, width, max) => {
    await cdp().send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: dpr, mobile: false });
    expect(devicePixelRatio).toBe(dpr);
    const image: ApiceImage = { png: await png64(), altText: 'Damero de prueba' };
    // El ancho del contenido más el relleno del bloque (1 rem por lado) y su borde.
    await mount(
      <div style={{ width: `calc(${width}px + 2rem + 2px)` }}>
        <Building image={image} axes={['agua', 'cobijo']} max={max} />
      </div>,
    );
    const img = host.querySelector('img')!;
    await img.decode();
    await expect.poll(() => img.getBoundingClientRect().width).toBe(64 * n);
    expect(img.getBoundingClientRect().height).toBe(64 * n);
    expect(getComputedStyle(img).imageRendering).toBe('pixelated');
  });
});
