// Comprobación del proyecto `browser` (D-T12 (002)): corre en Chromium real, no en jsdom.
import { describe, expect, it } from 'vitest';

describe('proyecto browser', () => {
  it('corre en Chromium con un DOM con maquetación', () => {
    expect(navigator.userAgent).toMatch(/Chrome/);
    const box = document.createElement('div');
    box.style.width = '64px';
    document.body.append(box);
    expect(box.getBoundingClientRect().width).toBe(64);
    box.remove();
  });
});
