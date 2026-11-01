// T-1.38: solicitud de inscripción (RF-4 (001)).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../data/api';
import { RequestPage, type RequestOps } from './RequestPage';
import { blockProblems } from '../testing/expectBlocks';

const ops = (submit = vi.fn().mockResolvedValue({ received: true })): RequestOps => ({ submit });

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo.org');
  await user.type(screen.getByLabelText('Nombre'), 'Ana');
  await user.type(screen.getByLabelText('Mensaje'), 'Quiero co-crear');
}

describe('RequestPage', () => {
  it('RF-4 (001): no deja enviar sin la casilla de tratamiento de datos', async () => {
    const o = ops();
    const user = userEvent.setup();
    render(<RequestPage ops={o} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/datos/i);
    expect(o.submit).not.toHaveBeenCalled();
  });

  it('RF-4 (001): envía los datos, el consentimiento y el campo trampa vacío, y confirma', async () => {
    const o = ops();
    const user = userEvent.setup();
    render(<RequestPage ops={o} />);
    await fill(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/recibimos/i));
    expect(o.submit).toHaveBeenCalledWith({
      email: 'ana@ejemplo.org',
      name: 'Ana',
      message: 'Quiero co-crear',
      accepted: true,
      website: '',
    });
  });

  it('RF-4 (001): la confirmación es la misma en cualquier caso', async () => {
    const texts: string[] = [];
    for (const answer of [{ received: true }, { received: true }]) {
      const user = userEvent.setup();
      const { unmount } = render(<RequestPage ops={ops(vi.fn().mockResolvedValue(answer))} />);
      await fill(user);
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
      texts.push((await screen.findByRole('status')).textContent ?? '');
      unmount();
    }
    expect(texts[0]).toBe(texts[1]);
  });

  it('RF-4 (001): si el envío falla mantiene lo escrito', async () => {
    const o = ops(vi.fn().mockRejectedValue(new ApiClientError('rate-limited')));
    const user = userEvent.setup();
    render(<RequestPage ops={o} />);
    await fill(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Ana');
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Quiero co-crear');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('RF-4 (001): el contador muestra los caracteres usados de 2.000', async () => {
    const user = userEvent.setup();
    render(<RequestPage ops={ops()} />);
    expect(screen.getByText('0 / 2.000')).toBeTruthy();
    await user.type(screen.getByLabelText('Mensaje'), 'hola 🌱');
    expect(screen.getByText('6 / 2.000')).toBeTruthy();
  });

  it('RF-4 (001): el campo trampa no se anuncia ni se enfoca', () => {
    render(<RequestPage ops={ops()} />);
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('RequestPage · estilos en línea (002)', () => {
  it('RF-2 (002) · 2.1: ningún estilo en línea con color ni con tamaño o posición escritos a mano', () => {
    const { container } = render(<RequestPage ops={ops()} />);
    const colors = blockProblems(container).filter((p) => p.startsWith('color'));
    const fixed = [...container.querySelectorAll<HTMLElement>('[style]')].map((el) => el.outerHTML.slice(0, 80));
    expect(colors).toEqual([]);
    expect(fixed).toEqual([]);
  });

  it('RF-4 (001): el campo trampa sigue fuera de la vista mediante una clase (D-T1 (002))', () => {
    render(<RequestPage ops={ops()} />);
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.closest('.honeypot')).not.toBeNull();
  });
});

describe('RequestPage · bloques (002)', () => {
  const kinds = (el: Element) => ['action-primary', 'action-secondary', 'action-destructive'].filter((c) => el.classList.contains(c));

  it('RF-6 (002) · 6.1, 6.3: campos, casilla, avisos y envío son bloques y «Enviar solicitud» es la acción principal', async () => {
    const user = userEvent.setup();
    const { container } = render(<RequestPage ops={ops(vi.fn().mockRejectedValue(new ApiClientError('rate-limited')))} />);
    const button = screen.getByRole('button', { name: 'Enviar solicitud' });
    expect(button.classList.contains('block')).toBe(true);
    expect(kinds(button)).toEqual(['action-primary']);
    expect(screen.getByRole('checkbox').classList.contains('choice')).toBe(true);
    expect(screen.getByRole('checkbox').classList.contains('block')).toBe(false);
    await fill(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(button);
    expect((await screen.findByRole('alert')).classList.contains('block')).toBe(true);
    expect(blockProblems(container)).toEqual([]);
  });

  it('RF-6 (002) · 6.1: la confirmación de envío es un bloque', async () => {
    const user = userEvent.setup();
    const { container } = render(<RequestPage ops={ops()} />);
    await fill(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect((await screen.findByRole('status')).classList.contains('block')).toBe(true);
    expect(blockProblems(container)).toEqual([]);
  });
});

describe('RequestPage · lote (003)', () => {
  it('RF-13 (003) · 13.1: el formulario va en un solo lote angosto', () => {
    const { container } = render(<RequestPage ops={ops()} />);
    const lots = container.querySelectorAll('.lot');
    expect(lots).toHaveLength(1);
    expect(lots[0]!.classList.contains('lot--access')).toBe(true);
    expect(lots[0]!.contains(screen.getByRole('button', { name: 'Enviar solicitud' }))).toBe(true);
  });

  it('RF-13 (003) · 13.1: la confirmación de envío también va en el lote', async () => {
    const user = userEvent.setup();
    const { container } = render(<RequestPage ops={ops()} />);
    await fill(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    const status = await screen.findByRole('status');
    expect(container.querySelectorAll('.lot')).toHaveLength(1);
    expect(container.querySelector('.lot')!.contains(status)).toBe(true);
  });

  it('RF-13 (003) · 13.2: la página no suma enlaces con forma de botón', () => {
    const { container } = render(<RequestPage ops={ops()} />);
    for (const link of container.querySelectorAll('a')) {
      expect(link.matches('.block, .action-primary, .action-secondary, .action-destructive, .icon-button')).toBe(false);
    }
  });
});
