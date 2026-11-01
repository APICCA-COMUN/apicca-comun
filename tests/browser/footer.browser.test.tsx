// RF-8 (003) · 8.1, 8.4, RF-16 (003) · 16.2, RF-3 (015), RNF-1 (015) · 1.2–1.3, RNF-2 (015) · Pie en Chromium real:
// fondo `footer-bg`, «Apoyado por» en `on-charcoal-muted`, logo de 28 px centrado con su zona libre y sin
// desplazamiento horizontal.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { SiteFooter } from '../../src/components/SiteFooter';

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

function token(name: string, property: 'color' | 'backgroundColor') {
  const probe = document.createElement('span');
  probe.style[property] = `var(--${name})`;
  host.append(probe);
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
  await page.viewport(1280, 800);
  await act(async () => root.unmount());
  host.remove();
});

describe.each(['light', 'dark'] as const)('pie en el tema %s (003)', (theme) => {
  beforeEach(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  it('RF-8 (003) · 8.1, 8.4, RF-5 (008) · 5.1, RNF-2 (015): fondo footer-bg y «Apoyado por» en on-charcoal-muted, de 16 px', async () => {
    await mount(<SiteFooter />);
    const footer = host.querySelector<HTMLElement>('footer')!;
    expect(getComputedStyle(footer).backgroundColor).toBe(token('footer-bg', 'backgroundColor'));
    const support = getComputedStyle(footer.querySelector('.site-footer__support')!);
    expect(support.color).toBe(token('on-charcoal-muted', 'color'));
    expect(support.fontSize).toBe('16px');
  });

  it('RF-16 (003) · 16.2: a 360 px no hay desplazamiento horizontal', async () => {
    await page.viewport(360, 740);
    await mount(<SiteFooter />);
    const doc = document.documentElement;
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
    const footer = host.querySelector<HTMLElement>('footer')!;
    expect(footer.scrollWidth).toBeLessThanOrEqual(footer.clientWidth);
  });
});

describe.each([360, 768, 1280])('apoyo del pie a %i px (015)', (width) => {
  async function show() {
    await page.viewport(width, 740);
    await mount(<SiteFooter />);
    const footer = host.querySelector<HTMLElement>('footer')!;
    const img = footer.querySelector<HTMLImageElement>('img')!;
    await expect.poll(() => img.complete && img.naturalWidth > 0).toBe(true);
    return { footer, img, link: footer.querySelector<HTMLElement>('a')!, text: footer.querySelector<HTMLElement>('.site-footer__support-text')! };
  }

  it('RF-3 (015): el apoyo va centrado en una sola línea, sin desplazamiento horizontal', async () => {
    const { footer, img, link, text } = await show();
    const box = footer.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    const l = img.getBoundingClientRect();
    expect(Math.abs((t.left + link.getBoundingClientRect().right) / 2 - (box.left + box.right) / 2)).toBeLessThanOrEqual(2);
    expect(t.top).toBeLessThan(l.bottom);
    expect(l.top).toBeLessThan(t.bottom);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  });

  it('RNF-1 (015) · 1.2: el logo mide 28 px de alto y conserva su proporción', async () => {
    const { img } = await show();
    const r = img.getBoundingClientRect();
    expect(r.height).toBeCloseTo(28, 1);
    expect(r.width / r.height).toBeCloseTo(419.18 / 109.44, 1);
  });

  it('RNF-1 (015) · 1.3: alrededor del logo queda libre al menos el 20 % de su alto', async () => {
    const { img, link, text } = await show();
    const l = img.getBoundingClientRect();
    const a = link.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    const zone = l.height * 0.2;
    expect(l.left - t.right).toBeGreaterThanOrEqual(zone);
    expect(l.top - a.top).toBeGreaterThanOrEqual(zone);
    expect(a.bottom - l.bottom).toBeGreaterThanOrEqual(zone);
    expect(a.right - l.right).toBeGreaterThanOrEqual(zone);
  });

  it('RNF-2 (015): el enlace mide al menos 44 px de alto', async () => {
    const { link } = await show();
    expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});
