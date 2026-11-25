// Movimiento en Chromium real (T-4.15, «E3 · Celda»): la acción principal (barra de tinta) se invierte a papel con borde al pasar
// el cursor y al pulsar, y el texto subrayado engorda su raya (en lugar de la elevación con sombra del diseño anterior;
// RF-9 (002) · 9.1, 9.2), nada sin cursor (9.3), cambio instantáneo con movimiento reducido (9.4) y ninguna animación en
// reposo (9.5).
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/piezas.css';

let host: HTMLDivElement;

async function emulate(features: { name: string; value: string }[]) {
  await cdp().send('Emulation.setEmulatedMedia', { features });
}

/** Un dispositivo táctil, sin cursor: `(hover: none)`. `setEmulatedMedia` no emula `hover`. */
async function touchDevice(enabled: boolean) {
  await cdp().send('Emulation.setTouchEmulationEnabled', enabled ? { enabled, maxTouchPoints: 1 } : { enabled });
}

/** El valor calculado de un color con un token, resuelto con un elemento auxiliar. */
function color(token: string, property: 'color' | 'backgroundColor' = 'backgroundColor'): string {
  const probe = document.createElement('div');
  probe.style[property] = `var(--${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

/** Espera a que termine la transición más larga posible (`duration-raise` ≤ 200 ms). */
const settle = () => new Promise((done) => setTimeout(done, 300));

function mount(): HTMLButtonElement {
  host.innerHTML = `
    <button type="button" class="block action-primary">Guardar</button>
    <button type="button" class="block action-secondary">Ver historial</button>
    <button type="button" class="block action-primary" disabled>Enviar</button>
    <p>Fuera</p>
  `;
  return host.querySelector('button')!;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(async () => {
  await userEvent.unhover(host.querySelector('p') ?? document.body).catch(() => undefined);
  host.remove();
  await emulate([]);
  await touchDevice(false);
});

it('RF-9 (002) · 9.1: con cursor, pasar sobre la acción principal la invierte (de tinta llena a papel) en duration-raise y el texto subrayado engorda su raya', async () => {
  expect(matchMedia('(hover: hover)').matches).toBe(true);
  const button = mount();
  const style = getComputedStyle(button);
  expect(style.boxShadow).toBe('none');
  expect(style.backgroundColor).toBe(color('text'));
  expect(style.color).toBe(color('background', 'color'));
  const duration = getComputedStyle(document.documentElement).getPropertyValue('--duration-raise').trim();
  expect(style.transitionProperty).toBe('background-color, color');
  expect(style.transitionDuration).toBe(`${parseFloat(duration) / 1000}s, ${parseFloat(duration) / 1000}s`);
  await userEvent.hover(button);
  await settle();
  expect(getComputedStyle(button).backgroundColor).toBe(color('background'));
  expect(getComputedStyle(button).color).toBe(color('text', 'color'));
  expect(getComputedStyle(button).boxShadow).toBe('none');
  // El texto subrayado no invierte ninguna caja: su raya pasa de 2 a 4 px.
  const link = host.querySelector<HTMLButtonElement>('button.action-secondary')!;
  expect(getComputedStyle(link).textDecorationThickness).toBe('2px');
  expect(getComputedStyle(link).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  await userEvent.hover(link);
  await settle();
  expect(getComputedStyle(link).textDecorationThickness).toBe('4px');
  expect(getComputedStyle(link).backgroundColor).toBe('rgba(0, 0, 0, 0)');
});

it('RF-9 (002) · 9.1, 6.5: un bloque deshabilitado no se invierte', async () => {
  mount();
  const disabled = host.querySelector<HTMLButtonElement>('button[disabled]')!;
  const before = getComputedStyle(disabled).backgroundColor;
  await userEvent.hover(disabled, { force: true });
  await settle();
  expect(getComputedStyle(disabled).backgroundColor).toBe(before);
  // La principal deshabilitada es papel con contorno discontinuo y texto apagado (no tinta llena): no pasa a ningún otro estado.
  expect(getComputedStyle(disabled).backgroundColor).toBe(color('background'));
  expect(getComputedStyle(disabled).borderTopStyle).toBe('dashed');
});

it('RF-9 (002) · 9.2: pulsar la acción principal la invierte de la misma manera', async () => {
  await touchDevice(true);
  const button = mount();
  button.focus();
  await userEvent.keyboard('{Space>}');
  await settle();
  expect(button.matches(':active')).toBe(true);
  expect(getComputedStyle(button).backgroundColor).toBe(color('background'));
  expect(getComputedStyle(button).color).toBe(color('text', 'color'));
  await userEvent.keyboard('{/Space}');
});

it('RF-9 (002) · 9.3: sin cursor, pasar por encima no invierte', async () => {
  await touchDevice(true);
  expect(matchMedia('(hover: none)').matches).toBe(true);
  const button = mount();
  await userEvent.hover(button);
  await settle();
  expect(button.matches(':hover')).toBe(true);
  expect(getComputedStyle(button).backgroundColor).toBe(color('text'));
  const link = host.querySelector<HTMLButtonElement>('button.action-secondary')!;
  await userEvent.hover(link);
  await settle();
  expect(getComputedStyle(link).textDecorationThickness).toBe('2px');
});

it('RF-9 (002) · 9.4: con movimiento reducido no hay transición y el cambio es inmediato', async () => {
  await emulate([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const button = mount();
  expect(getComputedStyle(button).transitionDuration).toBe('0s');
  await userEvent.hover(button);
  // Sin esperar a ninguna transición.
  expect(getComputedStyle(button).backgroundColor).toBe(color('background'));
  expect(document.getAnimations()).toEqual([]);
});

it('RF-9 (002) · 9.5: en reposo no hay ninguna animación ni transición en curso', async () => {
  mount();
  await settle();
  expect(document.getAnimations()).toEqual([]);
});
