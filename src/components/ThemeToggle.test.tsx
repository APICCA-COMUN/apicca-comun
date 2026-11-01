// Pruebas del componente ThemeToggle (RF-7 (003) · 7.5, RF-4 (003) · 4.5, RF-10 (002) · 10.2, RF-10 (002) · 10.3, RF-10 (002) · 10.4, D-T19 (002)).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_ICONS } from '../../shared/domain/identity';
import { THEME_KEY } from '../app/theme';
import { expectBlocks } from '../testing/expectBlocks';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RF-10 (002) · 10.2: nombre accesible «Cambiar a tema oscuro» en tema claro, sin aria-pressed (D-T19 (002)) y con descripción asociada', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a tema oscuro' });
    expect(button).toBeDefined();
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('aria-pressed')).toBe(false);

    const descriptionId = button.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    const descElement = document.getElementById(descriptionId!);
    expect(descElement).toBeDefined();
    expect(descElement?.textContent).toBe('Tema actual: claro');
  });

  it('RF-10 (002) · 10.2: nombre accesible «Cambiar a tema claro» y descripción cuando el tema vigente es oscuro', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    document.documentElement.dataset['theme'] = 'dark';
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Cambiar a tema claro' });
    expect(button.hasAttribute('aria-pressed')).toBe(false);

    const descriptionId = button.getAttribute('aria-describedby');
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Tema actual: oscuro');
  });

  it('RF-10 (002) · 10.3: al pulsar cambia el tema y lo recuerda en localStorage', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a tema oscuro' });

    await userEvent.click(button);

    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
    const descriptionId = button.getAttribute('aria-describedby');
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Tema actual: oscuro');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('RF-10 (002) · 10.4: si localStorage lanza, el tema se aplica igual en la página', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a tema oscuro' });

    await userEvent.click(button);

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
  });

  it('RF-7 (003) · 7.5, RF-4 (003) · 4.5: el botón es un botón de ícono (block icon-button) con un SVG decorativo', () => {
    const { container } = render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a tema oscuro' });
    expect(button.className).toBe('block icon-button');
    const svg = button.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(THEME_ICONS.moon.d);
    expect(button.textContent).toBe('');
    expectBlocks(container);
  });

  it('RF-7 (003) · 7.5: el ícono es el sol con el tema oscuro vigente y la luna con el claro', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button.querySelector('path')?.getAttribute('d')).toBe(THEME_ICONS.moon.d);
    await userEvent.click(button);
    expect(button.querySelector('path')?.getAttribute('d')).toBe(THEME_ICONS.sun.d);
  });

  it('RF-7 (003) · 7.5: «Tema actual: …» sigue en el DOM como texto solo para lectores (visually-hidden)', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    const description = document.getElementById(button.getAttribute('aria-describedby')!)!;
    expect(description.textContent).toBe('Tema actual: claro');
    expect(description.classList.contains('visually-hidden')).toBe(true);
  });
});
