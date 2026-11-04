import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiceImage } from '../data/apices';
import { Building } from './Building';

const image: ApiceImage = { png: new Uint8Array([137, 80, 78, 71]), altText: 'Un tanque de agua entre árboles' };

/** Simula el ancho disponible del contenedor del edificio. */
function withWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const icons = (container: HTMLElement) => within(container.querySelector('.building')! as HTMLElement).getAllByRole('img').filter((el) => el.tagName === 'svg');

describe('Building', () => {
  it('RF-7 (002) · 7.1: es un bloque charcoal con los íconos de todos sus ejes en el orden canónico', () => {
    const { container } = render(<Building image={image} axes={['comunicación', 'agua', 'energía']} max={2} />);
    const building = container.querySelector('.building')!;
    expect(building.classList.contains('block')).toBe(true);
    expect(icons(container).map((icon) => icon.getAttribute('aria-label'))).toEqual(['Agua', 'Energía', 'Comunicación']);
    expect(screen.getByRole('img', { name: image.altText }).tagName).toBe('IMG');
  });

  it('RF-7 (002) · 7.2, D-T10 (002): el lado es 64·n, con n según el ancho disponible y el máximo', () => {
    withWidth(300);
    const { unmount } = render(<Building image={image} axes={['agua']} max={4} />);
    const big = screen.getByRole('img', { name: image.altText });
    expect([big.style.width, big.style.height]).toEqual(['256px', '256px']);
    unmount();
    render(<Building image={image} axes={['agua']} max={2} />);
    expect(screen.getByRole('img', { name: image.altText }).style.width).toBe('128px');
  });

  it('RF-7 (002) · 7.2: sin ancho medido el edificio usa n = 1, 64 px', () => {
    withWidth(0);
    render(<Building image={image} axes={['agua']} max={4} />);
    expect(screen.getByRole('img', { name: image.altText }).style.width).toBe('64px');
  });

  it('RF-7 (002) · 7.4: sin imagen muestra los íconos y el texto «Sin imagen»', () => {
    const { container } = render(<Building image={null} axes={['cobijo', 'alimento']} max={2} />);
    expect(icons(container).map((icon) => icon.getAttribute('aria-label'))).toEqual(['Alimento', 'Cobijo']);
    expect(screen.getByText('Sin imagen')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('RF-7 (002) · 7.4: si la imagen no carga, muestra «Sin imagen» y conserva los íconos', () => {
    const { container } = render(<Building image={image} axes={['agua']} max={2} />);
    fireEvent.error(screen.getByRole('img', { name: image.altText }));
    expect(screen.getByText('Sin imagen')).toBeTruthy();
    expect(screen.queryByRole('img', { name: image.altText })).toBeNull();
    expect(icons(container)).toHaveLength(1);
  });
  it('RF-7 (002) · 7.2, RF-4 (019) · 4.2: con etapa, la estructura suma al lado de 64·n el marco de 2 px del cuerpo, y n sale del ancho sin ese marco', () => {
    // 132 px: sin restar el marco darían dos celdas (128 px) y la estructura de 132 px no cabría.
    withWidth(132);
    const { container } = render(<Building image={image} axes={['agua']} stage="prototipo" max={4} />);
    expect(screen.getByRole('img', { name: image.altText }).style.width).toBe('128px');
    expect((container.querySelector('.building__structure') as HTMLElement).style.width).toBe('132px');
  });

  it('RF-4 (019) · 4.1, D-T19 (019): una idea es solo la base y no muestra la imagen aunque la tenga', () => {
    const { container } = render(<Building image={image} axes={['energía', 'agua']} stage="idea" max={2} />);
    const building = container.querySelector('.building')!;
    expect(building.getAttribute('data-stage')).toBe('idea');
    expect(container.querySelector('.building__base')).not.toBeNull();
    expect(container.querySelector('.building__body')).toBeNull();
    expect(container.querySelector('.building__roof')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.building__stage')!.textContent).toBe('Idea');
  });

  it('RF-4 (019) · 4.2, D-T19 (019): un prototipo suma el cuerpo con la imagen pixelada, o el marcador sin imagen', () => {
    const { container, rerender } = render(<Building image={image} axes={['agua']} stage="prototipo" max={2} />);
    expect(container.querySelector('.building__roof')).toBeNull();
    expect(container.querySelector('.building__body img.pixel-image')).not.toBeNull();
    expect(container.querySelector('.building__stage')!.textContent).toBe('Prototipo');
    rerender(<Building image={null} axes={['agua']} stage="prototipo" max={2} />);
    expect(container.querySelector('.building__body .pixel-image--empty')).not.toBeNull();
  });

  it('RF-4 (019) · 4.3, D-T19 (019): en marcha suma el techo; las partes van en el orden techo, cuerpo, base', () => {
    const { container } = render(<Building image={image} axes={['agua']} stage="en marcha" max={2} />);
    const parts = Array.from(container.querySelectorAll('.building__roof, .building__body, .building__base')).map((el) => el.className);
    expect(parts).toEqual(['building__roof', 'building__body', 'building__base']);
    expect(container.querySelector('.building__stage')!.textContent).toBe('En marcha');
  });

  it('RF-4 (019) · 4.1, caso límite §6: la base toma el primer eje canónico y los cinco íconos siguen visibles', () => {
    const { container } = render(
      <Building image={null} axes={['comunicación', 'cobijo', 'energía', 'alimento', 'agua']} stage="idea" max={2} />,
    );
    expect(container.querySelector('.building')!.classList.contains('building--axis-agua')).toBe(true);
    expect(icons(container)).toHaveLength(5);
  });

  it('RF-9 (019) · 9.1, 9.3, D-T21 (019): el pin solo aparece con necesidades, es decorativo y no lleva texto', () => {
    const { container, rerender } = render(<Building image={null} axes={['agua']} stage="idea" max={2} />);
    expect(container.querySelector('.building__pin')).toBeNull();
    rerender(<Building image={null} axes={['agua']} stage="idea" needs max={2} />);
    const pin = container.querySelector('.building__pin')!;
    expect(pin.getAttribute('aria-hidden')).toBe('true');
    expect(pin.textContent).toBe('');
  });

  it('RF-7 (002) · 7.4, RF-4 (019): sin etapa el edificio es el de siempre, sin partes ni pin', () => {
    const { container } = render(<Building image={image} axes={['agua']} max={2} />);
    expect(container.querySelector('.building__base, .building__body, .building__roof, .building__stage, .building__pin')).toBeNull();
    expect(container.querySelector('.building')!.hasAttribute('data-stage')).toBe(false);
    expect(container.querySelector('img')).not.toBeNull();
  });
});
