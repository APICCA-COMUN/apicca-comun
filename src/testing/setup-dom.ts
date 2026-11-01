// Setup del proyecto `unit-dom` de Vitest: desmonta lo pintado tras cada prueba
// (sin `globals: true`, Testing Library no registra su `afterEach(cleanup)` sola) y
// dobla lo que jsdom no implementa.
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom no implementa `scrollIntoView` ni `scrollTo`: dobles que las pruebas pueden observar.
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();

// jsdom tampoco implementa `matchMedia`. El doble responde «claro» y no avisa de cambios;
// la prueba que necesite otra cosa —`src/app/theme.test.tsx`— pone el suyo.
window.matchMedia = ((consulta: string) => ({
  matches: false,
  media: consulta,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia;

afterEach(() => {
  cleanup();
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
});
