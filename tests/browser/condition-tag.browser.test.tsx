// RF-6 (003) · 6.1, 6.2, D-T20 (003) · Etiqueta de condición en Chromium real: punto de color seguido del texto,
// de 14 px y peso 700, en text-muted, sin píldora ni borde; con colores forzados el texto sigue.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { ConditionTag, type Condition } from '../../src/components/ConditionTag';

const CONDITIONS: Array<[Condition, string]> = [
  ['visibility', 'Privado'],
  ['archived', 'Archivado'],
  ['status', 'prototipo'],
  ['reference', 'Retirada'],
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

function tags() {
  return (
    <>
      {CONDITIONS.map(([condition, text]) => (
        <ConditionTag key={condition} condition={condition}>
          {text}
        </ConditionTag>
      ))}
    </>
  );
}

beforeEach(() => {
  document.documentElement.dataset['theme'] = 'light';
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await forcedColors(false);
  await act(async () => root.unmount());
  host.remove();
});

describe('ConditionTag en el navegador (003)', () => {
  it('RF-6 (003) · 6.1: punto de color y luego el texto, de 14 px, peso 700, en text-muted, sin píldora ni borde', async () => {
    await mount(tags());
    const muted = (() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--text-muted)';
      host.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    })();
    for (const [condition, text] of CONDITIONS) {
      const tag = host.querySelector<HTMLElement>(`.tag[data-condition="${condition}"]`)!;
      const style = getComputedStyle(tag);
      expect(tag.textContent, condition).toBe(text);
      expect(style.fontSize, condition).toBe('14px');
      expect(style.fontWeight, condition).toBe('700');
      expect(style.color, condition).toBe(muted);
      expect(style.borderTopWidth, condition).toBe('0px');
      expect(style.borderTopStyle, condition).toBe('none');
      expect(style.borderTopLeftRadius, condition).toBe('0px');
      expect(style.backgroundColor, condition).toBe('rgba(0, 0, 0, 0)');
      const dot = tag.querySelector<HTMLElement>('.tag-dot')!;
      const dotStyle = getComputedStyle(dot);
      expect(dotStyle.backgroundColor, condition).not.toBe('rgba(0, 0, 0, 0)');
      expect(dotStyle.borderTopLeftRadius, condition).toBe('50%');
      const dotBox = dot.getBoundingClientRect();
      expect(dotBox.width, condition).toBeGreaterThan(0);
      const range = document.createRange();
      range.selectNodeContents(tag.lastChild!);
      expect(dotBox.right, condition).toBeLessThanOrEqual(range.getBoundingClientRect().left);
    }
  });

  it('RF-6 (003) · 6.2: con colores forzados la etiqueta sigue mostrando su texto', async () => {
    await forcedColors(true);
    await mount(tags());
    for (const [condition, text] of CONDITIONS) {
      const tag = host.querySelector<HTMLElement>(`.tag[data-condition="${condition}"]`)!;
      const style = getComputedStyle(tag);
      expect(tag.textContent, condition).toBe(text);
      expect(style.visibility, condition).toBe('visible');
      expect(style.display, condition).not.toBe('none');
      const range = document.createRange();
      range.selectNodeContents(tag.lastChild!);
      expect(range.getBoundingClientRect().width, condition).toBeGreaterThan(0);
    }
  });
});
