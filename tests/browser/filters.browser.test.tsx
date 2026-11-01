// RF-12 (003) · 12.3, RF-4 (003) · 4.5, D-T18 (003) · Filtros de eje en Chromium real: 44 × 44 px, redondos y con el
// estado presionado visible sin depender solo del color (anillo y trazo del ícono).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { Filters } from '../../src/components/Filters';
import { NO_FILTERS } from '../../shared/domain/discovery';

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
  await page.viewport(1280, 800);
  await act(async () => root.unmount());
  host.remove();
});

describe.each(['light', 'dark'] as const)('filtros de eje en el tema %s (003)', (theme) => {
  beforeEach(() => {
    document.documentElement.dataset['theme'] = theme;
  });

  it('RF-12 (003) · 12.3: cada filtro mide 44 × 44 y es redondo', async () => {
    await mount(<Filters filters={NO_FILTERS} onChange={() => {}} />);
    const buttons = host.querySelectorAll<HTMLElement>('fieldset button');
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      const box = button.getBoundingClientRect();
      expect(Math.round(box.width)).toBe(44);
      expect(Math.round(box.height)).toBe(44);
      expect(getComputedStyle(button).borderRadius).toMatch(/^(50%|22px)$/);
    }
  });

  it('RF-12 (003) · 12.3, RF-4 (003) · 4.5: el estado presionado se ve sin depender solo del color', async () => {
    await mount(<Filters filters={{ axes: ['agua'], status: null }} onChange={() => {}} />);
    const on = host.querySelector<HTMLElement>('button[aria-pressed="true"]')!;
    const off = host.querySelector<HTMLElement>('button[aria-pressed="false"]')!;
    expect(getComputedStyle(on).boxShadow).not.toBe(getComputedStyle(off).boxShadow);
    expect(getComputedStyle(on).boxShadow).toContain('inset');
    expect(getComputedStyle(on.querySelector('svg')!).strokeWidth).not.toBe(getComputedStyle(off.querySelector('svg')!).strokeWidth);
  });
});
