// RF-1 (024) · 1.1 · El formulario de abrir una propuesta y el de revisarla muestran cada etiqueta encima de su campo, y ningún
// otro campo ni etiqueta comparte su fila, en Chromium real a 1280 px y a 360 px (RF-5 (003) · 5.2).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import '../../src/styles/piezas.css';
import { AmendmentForm } from '../../src/components/AmendmentForm';

const SECTIONS = [
  { id: 's1', title: 'Preámbulo' },
  { id: 's2', title: 'Cuidados' },
];

let bench: HTMLDivElement | undefined;

afterEach(async () => {
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

/** Monta el formulario en un ancho dado y devuelve la raíz del banco de pruebas. */
async function mountForm(width: number, mode: 'open' | 'revise'): Promise<HTMLElement> {
  await page.viewport(width, 800);
  bench = document.createElement('div');
  document.body.append(bench);
  const root = createRoot(bench);
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      root.render(
        <main>
          {mode === 'open' ? (
            <AmendmentForm mode="open" sections={SECTIONS} onSubmit={vi.fn()} />
          ) : (
            <AmendmentForm
              mode="revise"
              sections={SECTIONS}
              kind="change"
              sectionId="s1"
              initial={{ title: 'Título', text: 'Texto', motive: 'Motivo' }}
              onSubmit={vi.fn()}
            />
          )}
        </main>,
      );
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
  return bench;
}

describe.each([1280, 360])('formulario de propuestas a %i px', (width) => {
  describe.each(['open', 'revise'] as const)('modo %s', (mode) => {
    it('RF-1 (024) · 1.1: cada etiqueta queda encima de su campo, sin otro campo en su fila', async () => {
      const root = await mountForm(width, mode);
      const labels = [...root.querySelectorAll<HTMLLabelElement>('form.amendment-form label[for]')];
      expect(labels.length).toBeGreaterThanOrEqual(mode === 'open' ? 5 : 3);
      const controls = [...root.querySelectorAll<HTMLElement>('form.amendment-form :is(input, select, textarea)')];
      for (const label of labels) {
        const field = root.querySelector<HTMLElement>(`#${label.htmlFor}`)!;
        const l = label.getBoundingClientRect();
        const f = field.getBoundingClientRect();
        // Encima: el borde inferior de la etiqueta no pasa del superior del campo.
        expect(l.bottom).toBeLessThanOrEqual(f.top + 0.5);
        // Ningún otro campo ni etiqueta comparte su fila (el rectángulo de otro no se cruza en vertical con el de la etiqueta o el campo).
        for (const other of [...labels, ...controls]) {
          if (other === label || other === field) continue;
          const o = other.getBoundingClientRect();
          for (const own of [l, f]) {
            const overlaps = o.top < own.bottom - 0.5 && o.bottom > own.top + 0.5;
            expect(overlaps, `«${label.textContent}» comparte fila con ${other.id || other.textContent}`).toBe(false);
          }
        }
      }
    });
  });
});
