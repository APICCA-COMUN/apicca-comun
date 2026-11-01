// Movimiento en Chromium real (T-4.15): elevación al pasar el cursor y al pulsar
// (RF-9 (002) · 9.1, 9.2), nada sin cursor (9.3), cambio instantáneo con movimiento reducido (9.4)
// y ninguna animación en reposo (9.5).
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';

let host: HTMLDivElement;

async function emulate(features: { name: string; value: string }[]) {
  await cdp().send('Emulation.setEmulatedMedia', { features });
}

/** Un dispositivo táctil, sin cursor: `(hover: none)`. `setEmulatedMedia` no emula `hover`. */
async function touchDevice(enabled: boolean) {
  await cdp().send('Emulation.setTouchEmulationEnabled', enabled ? { enabled, maxTouchPoints: 1 } : { enabled });
}

/** El valor calculado de `box-shadow` con un token, resuelto con un elemento auxiliar. */
function shadow(token: string): string {
  const probe = document.createElement('div');
  probe.style.boxShadow = `var(--${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).boxShadow;
  probe.remove();
  return value;
}

/** Espera a que termine la transición más larga posible (`duration-raise` ≤ 200 ms). */
const settle = () => new Promise((done) => setTimeout(done, 300));

function mount(): HTMLButtonElement {
  host.innerHTML = `
    <button type="button" class="block action-secondary">Ver historial</button>
    <button type="button" class="block action-primary" disabled>Guardar</button>
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

it('RF-9 (002) · 9.1: con cursor, pasar sobre un bloque interactivo lo eleva con shadow-raised en duration-raise', async () => {
  expect(matchMedia('(hover: hover)').matches).toBe(true);
  const button = mount();
  const style = getComputedStyle(button);
  expect(style.boxShadow).toBe(shadow('shadow-block'));
  const duration = getComputedStyle(document.documentElement).getPropertyValue('--duration-raise').trim();
  expect(style.transitionProperty).toBe('box-shadow');
  expect(style.transitionDuration).toBe(`${parseFloat(duration) / 1000}s`);
  await userEvent.hover(button);
  await settle();
  expect(getComputedStyle(button).boxShadow).toBe(shadow('shadow-raised'));
});

it('RF-9 (002) · 9.1, 6.5: un bloque deshabilitado no se eleva', async () => {
  mount();
  const disabled = host.querySelector<HTMLButtonElement>('button[disabled]')!;
  await userEvent.hover(disabled, { force: true });
  await settle();
  expect(getComputedStyle(disabled).boxShadow).toBe('none');
});

it('RF-9 (002) · 9.2: pulsar un bloque interactivo lo eleva de la misma manera', async () => {
  await touchDevice(true);
  const button = mount();
  button.focus();
  await userEvent.keyboard('{Space>}');
  await settle();
  expect(button.matches(':active')).toBe(true);
  expect(getComputedStyle(button).boxShadow).toBe(shadow('shadow-raised'));
  await userEvent.keyboard('{/Space}');
});

it('RF-9 (002) · 9.3: sin cursor, pasar por encima no eleva', async () => {
  await touchDevice(true);
  expect(matchMedia('(hover: none)').matches).toBe(true);
  const button = mount();
  await userEvent.hover(button);
  await settle();
  expect(button.matches(':hover')).toBe(true);
  expect(getComputedStyle(button).boxShadow).toBe(shadow('shadow-block'));
});

it('RF-9 (002) · 9.4: con movimiento reducido no hay transición y el cambio es inmediato', async () => {
  await emulate([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const button = mount();
  expect(getComputedStyle(button).transitionDuration).toBe('0s');
  await userEvent.hover(button);
  // Sin esperar a ninguna transición.
  expect(getComputedStyle(button).boxShadow).toBe(shadow('shadow-raised'));
  expect(document.getAnimations()).toEqual([]);
});

it('RF-9 (002) · 9.5: en reposo no hay ninguna animación ni transición en curso', async () => {
  mount();
  await settle();
  expect(document.getAnimations()).toEqual([]);
});
