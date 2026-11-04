// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindModifierWheelZoom } from './wheel';

function setup() {
  const map = { zoomIn: vi.fn(), zoomOut: vi.fn() };
  const el = document.createElement('div');
  const off = bindModifierWheelZoom(el, map);
  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init });
    el.dispatchEvent(event);
    return event;
  };
  return { map, off, wheel };
}

describe('rueda con modificador', () => {
  it('RF-10 (019) · 10.3: sin modificador no hace nada y la página se desplaza', () => {
    const { map, wheel } = setup();
    const event = wheel({ deltaY: -100 });
    expect(map.zoomIn).not.toHaveBeenCalled();
    expect(map.zoomOut).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('RF-10 (019) · 10.3: con Ctrl acerca o aleja según el signo', () => {
    const { map, wheel } = setup();
    expect(wheel({ ctrlKey: true, deltaY: -100 }).defaultPrevented).toBe(true);
    expect(map.zoomIn).toHaveBeenCalledTimes(1);
    expect(wheel({ ctrlKey: true, deltaY: 100 }).defaultPrevented).toBe(true);
    expect(map.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('RF-10 (019) · 10.3: con ⌘ acerca o aleja según el signo', () => {
    const { map, wheel } = setup();
    wheel({ metaKey: true, deltaY: -1 });
    wheel({ metaKey: true, deltaY: 1 });
    expect(map.zoomIn).toHaveBeenCalledTimes(1);
    expect(map.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('RF-10 (019) · 10.3: tras la limpieza no hace nada', () => {
    const { map, off, wheel } = setup();
    off();
    const event = wheel({ ctrlKey: true, deltaY: -100 });
    expect(map.zoomIn).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
