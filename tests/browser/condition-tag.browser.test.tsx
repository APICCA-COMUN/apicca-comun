// RF-7 (024) · 7.1 · La etiqueta «privado» de la tarjeta de un ápice privado se ve entera en Chromium real: queda dentro de la tarjeta a 360 px y a 1280 px.
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { ApiceCard, type ApiceCardData } from '../../src/components/ApiceCard';

const PRIVATE_APICE: ApiceCardData = {
  id: 'a1',
  name: 'Cosecha de lluvia',
  description: 'Captamos agua de lluvia en el techo comunal.',
  axes: ['agua'],
  status: 'prototipo',
  updatedAt: { seconds: 1_790_000_000, nanoseconds: 0 },
  needs: '',
  visibility: 'private',
};

let bench: HTMLDivElement | undefined;

afterEach(async () => {
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

/** Monta la tarjeta de un ápice privado en un ancho dado y devuelve la tarjeta y su etiqueta. */
async function mountCard(width: number): Promise<{ card: DOMRect; tag: DOMRect }> {
  await page.viewport(width, 800);
  bench = document.createElement('div');
  document.body.append(bench);
  const root = createRoot(bench);
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      root.render(<main><ApiceCard apice={PRIVATE_APICE} /></main>);
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
  const article = bench.querySelector<HTMLElement>('article')!;
  const tag = bench.querySelector<HTMLElement>('[data-condition="visibility"]')!;
  return { card: article.getBoundingClientRect(), tag: tag.getBoundingClientRect() };
}

describe.each([360, 1280])('etiqueta «privado» a %i px', (width) => {
  it('RF-7 (024) · 7.1: la etiqueta queda dentro de la tarjeta y se lee «privado»', async () => {
    const { card, tag } = await mountCard(width);
    expect(tag.width).toBeGreaterThan(0);
    expect(tag.left).toBeGreaterThanOrEqual(card.left);
    expect(tag.right).toBeLessThanOrEqual(card.right);
    expect(bench!.querySelector('[data-condition="visibility"]')?.textContent).toBe('privado');
  });
});
