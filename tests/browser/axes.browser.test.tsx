// Ejes y etiquetas en Chromium real: los cinco glifos se distinguen por su forma en monocromo
// (T-5.9, RF-4 (002) · 4.3, 4.5, plan §9.4) y, con colores forzados, las etiquetas y los glifos siguen
// visibles y distinguibles por la losa, el texto y la forma (T-5.8, RF-13 (002) · 13.2, RF-4 (002) · 4.5, RNF-1 (002)).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { AXES } from '../../shared/domain/apice';
import { THEMES } from '../../shared/domain/identity';
import { AxisIcon } from '../../src/components/AxisIcon';
import { ConditionTag, type Condition } from '../../src/components/ConditionTag';

const SIDE = 24;
const CONDITIONS: Array<[Condition, string]> = [
  ['visibility', 'Privado'],
  ['archived', 'Archivado'],
  ['status', 'prototipo'],
];

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

/** El glifo rasterizado a 24 px en monocromo, sin la losa: un bit por píxel, encendido si queda tinta. */
async function rasterize(svg: SVGSVGElement): Promise<boolean[]> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(SIDE));
  copy.setAttribute('height', String(SIDE));
  copy.querySelector('.glifo__losa')?.remove();
  const path = copy.querySelector('path')!;
  path.setAttribute('fill', '#000');
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(copy.outerHTML)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = SIDE;
  canvas.height = SIDE;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, SIDE, SIDE);
  const { data } = context.getImageData(0, 0, SIDE, SIDE);
  const bits: boolean[] = [];
  for (let i = 3; i < data.length; i += 4) bits.push(data[i]! >= 128);
  return bits;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete document.documentElement.dataset['theme'];
  await forcedColors(false);
});

it('RF-4 (002) · 4.3, 4.5: rasterizados a 24 px en monocromo, cada par de glifos difiere en al menos un 12 % de la tinta que ocupan entre los dos', async () => {
  await mount(
    <>
      {AXES.map((axis) => (
        <AxisIcon key={axis} axis={axis} labelled />
      ))}
    </>,
  );
  const icons = [...host.querySelectorAll('svg')];
  const rasters = await Promise.all(icons.map(rasterize));
  for (const raster of rasters) expect(raster.some(Boolean)).toBe(true);
  const close: string[] = [];
  for (let a = 0; a < rasters.length; a += 1) {
    for (let b = a + 1; b < rasters.length; b += 1) {
      const differing = rasters[a]!.filter((bit, i) => bit !== rasters[b]![i]).length;
      const union = rasters[a]!.filter((bit, i) => bit || rasters[b]![i]).length;
      const share = differing / union;
      if (share < 0.12) close.push(`${AXES[a]} y ${AXES[b]}: ${(share * 100).toFixed(1)} %`);
    }
  }
  expect(close).toEqual([]);
});

describe.each(THEMES)('con colores forzados en el tema %s', (theme) => {
  // La forma de la etiqueta pasó a RF-6 (003) (sin borde ni píldora) y, en el QA #21.2, sin punto: lo que se conserva visible es el texto.
  it('RF-13 (002) · 13.2, RNF-1 (002), RF-6 (003) · 6.2, QA #21.2: cada etiqueta conserva su texto visible y no lleva punto', async () => {
    document.documentElement.dataset['theme'] = theme;
    await forcedColors(true);
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
    await mount(
      <>
        {CONDITIONS.map(([condition, text]) => (
          <ConditionTag key={condition} condition={condition}>
            {text}
          </ConditionTag>
        ))}
      </>,
    );
    for (const [condition, text] of CONDITIONS) {
      const tag = host.querySelector<HTMLElement>(`.tag[data-condition="${condition}"]`)!;
      const style = getComputedStyle(tag);
      expect(tag.textContent).toBe(text);
      const canvas = getComputedStyle(document.body).backgroundColor;
      expect(tag.querySelector('.tag-dot')).toBeNull();
      expect(style.color).not.toBe(canvas);
    }
  });

  it('RF-4 (002) · 4.5, RNF-1 (002): cada glifo conserva su forma en CanvasText sobre una losa en Canvas, y su forma propia', async () => {
    document.documentElement.dataset['theme'] = theme;
    await forcedColors(true);
    await mount(
      <>
        {AXES.map((axis) => (
          <AxisIcon key={axis} axis={axis} labelled />
        ))}
      </>,
    );
    // Los colores del sistema se resuelven con un elemento de prueba: el fondo del cuerpo puede quedar transparente.
    const probe = document.createElement('span');
    host.append(probe);
    probe.style.color = 'Canvas';
    const canvas = getComputedStyle(probe).color;
    probe.style.color = 'CanvasText';
    const text = getComputedStyle(probe).color;
    probe.remove();
    for (const icon of host.querySelectorAll('svg.glifo')) {
      const tile = getComputedStyle(icon.querySelector('.glifo__losa')!);
      const shape = getComputedStyle(icon.querySelector('.glifo__forma')!);
      expect(tile.fill).toBe(canvas);
      expect(shape.fill).toBe(text);
      expect(shape.fill).not.toBe(tile.fill);
    }
    const shapes = [...host.querySelectorAll('.glifo__forma')];
    expect(new Set(shapes.map((path) => path.getAttribute('d'))).size).toBe(AXES.length);
  });
});
