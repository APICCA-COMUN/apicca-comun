import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PixelImage } from './PixelImage';
import { blockProblems, expectBlocks } from '../testing/expectBlocks';

describe('PixelImage', () => {
  it('RF-18 (001): con imagen muestra el PNG con su texto alternativo, sin suavizar los píxeles', () => {
    render(<PixelImage image={{ altText: 'Un pozo de agua', png: new Uint8Array([137, 80, 78, 71]) }} />);
    const img = screen.getByRole('img', { name: 'Un pozo de agua' });
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    // El suavizado desactivado vive en la clase `pixel-image` (PixelImage.css); jsdom no carga hojas.
    expect(img.classList.contains('pixel-image')).toBe(true);
  });

  it('RF-18 (001): sin imagen muestra un marcador que lo dice, no un hueco', () => {
    render(<PixelImage image={null} />);
    expect(screen.getByRole('img', { name: 'Sin imagen' })).toBeTruthy();
  });

  it('RNF-2 (001): el marcador acepta un nombre accesible propio', () => {
    render(<PixelImage image={null} emptyLabel="Este ápice aún no tiene imagen" />);
    expect(screen.getByRole('img', { name: 'Este ápice aún no tiene imagen' })).toBeTruthy();
  });
});

/** Estilos en línea con un tamaño escrito a mano (RF-2 (002) · 2.1, D-T20 (002)). */
const fixedSizes = (container: ParentNode): string[] =>
  [...container.querySelectorAll<HTMLElement>('[style]')]
    .filter((el) =>
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size', 'padding', 'margin', 'top', 'left'].some(
        (property) => el.style.getPropertyValue(property) !== '',
      ),
    )
    .map((el) => el.outerHTML.slice(0, 80));

describe('PixelImage · bloques y clases (002)', () => {
  const png = new Uint8Array([137, 80, 78, 71]);

  it('RF-2 (002) · 2.1: sin estilos en línea con color ni con tamaño escrito a mano, con imagen y sin ella', () => {
    const withImage = render(<PixelImage image={{ altText: 'Un pozo', png }} />);
    expect(blockProblems(withImage.container).filter((p) => p.startsWith('color'))).toEqual([]);
    expect(fixedSizes(withImage.container)).toEqual([]);
    withImage.unmount();
    const empty = render(<PixelImage image={null} />);
    expect(blockProblems(empty.container).filter((p) => p.startsWith('color'))).toEqual([]);
    expect(fixedSizes(empty.container)).toEqual([]);
  });

  it('RF-18 (001): el suavizado desactivado va en la clase pixel-image, no en línea (D-T1 (002))', () => {
    render(<PixelImage image={{ altText: 'Un pozo', png }} />);
    const img = screen.getByRole('img', { name: 'Un pozo' });
    expect(img.classList.contains('pixel-image')).toBe(true);
    expect(img.getAttribute('style')).toBeNull();
  });

  it('RF-6 (002) · 6.1: el marcador sin imagen pasa expectBlocks', () => {
    const { container } = render(<PixelImage image={null} />);
    expect(container.querySelector('.pixel-image--empty')).not.toBeNull();
    expectBlocks(container);
  });
});
