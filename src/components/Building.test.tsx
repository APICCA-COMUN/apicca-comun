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
});
