// RF-1 (002) · 1.6 y RF-2 (003) · 2.1–2.4: el logo en Chromium real, con colores propios y con colores forzados.
// Vitest Browser no trae `page.emulateMedia`; se emula con CDP (`Emulation.setEmulatedMedia`).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import { hexToRgb, THEMES, TOKENS } from '../../shared/domain/identity';
import { Logo } from '../../src/components/Logo';

const rgb = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;

let host: HTMLDivElement;
let root: Root;

async function emulateForcedColors(value: 'active' | 'none') {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value }] });
}

/** Resuelve un color del sistema a su valor calculado con un elemento auxiliar. */
function resolveSystemColor(name: 'CanvasText' | 'Canvas', property: 'color' | 'backgroundColor') {
  const probe = document.createElement('span');
  probe.style[property] = name;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  root.unmount();
  host.remove();
  delete document.documentElement.dataset['theme'];
  await emulateForcedColors('none');
});

describe('Logo (navegador)', () => {
  it('RF-1 (002) · 1.6: con colores forzados todo el trazado es CanvasText y no hay placa', async () => {
    await emulateForcedColors('active');
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);
    root.render(<Logo />);
    await expect.poll(() => host.querySelectorAll('path').length).toBe(3);
    const layers = [...host.querySelectorAll<SVGPathElement>('.logo__layer')];
    const text = resolveSystemColor('CanvasText', 'color');
    for (const layer of layers) expect(getComputedStyle(layer).fill).toBe(text);
    expect(host.querySelector('.logo__plate')).toBeNull();
  });

  it.each(THEMES)('RF-2 (003) · 2.2–2.4: en el tema %s cada capa usa su token y no hay placa', async (theme) => {
    document.documentElement.dataset['theme'] = theme;
    await emulateForcedColors('none');
    root.render(<Logo />);
    await expect.poll(() => host.querySelectorAll('path').length).toBe(3);
    expect(host.querySelector('.logo__plate')).toBeNull();
    const probe = (token: string) => {
      const el = document.createElement('span');
      el.style.color = `var(--${token})`;
      document.body.append(el);
      const value = getComputedStyle(el).color;
      el.remove();
      return value;
    };
    const tokens = new Set<string>();
    for (const layer of host.querySelectorAll<SVGPathElement>('.logo__layer')) {
      const token = [...layer.classList].find((c) => c.startsWith('logo__layer--'))!.slice('logo__layer--'.length);
      tokens.add(token);
      expect(getComputedStyle(layer).fill).toBe(probe(token));
    }
    expect([...tokens].sort()).toEqual(['logo-blue', 'logo-gray', 'logo-red']);
    expect(probe('logo-gray')).toBe(rgb(TOKENS[theme]['logo-gray']));
    expect(probe('logo-red')).toBe(rgb(TOKENS[theme]['logo-red']));
    expect(probe('logo-blue')).toBe(rgb(TOKENS[theme]['logo-blue']));
  });

  it('RF-1 (002) · 1.1: el logo de la cabecera mide 32 px de alto (D-T16 (002))', async () => {
    root.render(<Logo />);
    await expect.poll(() => host.querySelector('svg')?.getBoundingClientRect().height).toBe(32);
  });
});
