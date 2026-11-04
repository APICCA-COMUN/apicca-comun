// RF-14 (019), D-T8 (019): `Dialog` en jsdom, por el camino sin `showModal` (atributo `open`).
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function Harness({ dismissible, onClose = () => undefined }: { dismissible?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      <Dialog
        open={open}
        labelledBy="t"
        {...(dismissible === undefined ? {} : { dismissible })}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      >
        <h2 id="t">Título</h2>
        <input aria-label="Texto" />
        <button type="button" onClick={() => setOpen(false)}>Cerrar</button>
      </Dialog>
    </>
  );
}

const dialogElement = () => document.querySelector('dialog')!;

describe('Dialog', () => {
  it('RF-14 (019) · 14.1, D-T8 (019): cerrado no se ve, pero sus hijos siguen montados; abierto se nombra con su título', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Texto', { selector: 'input' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog', { name: 'Título' })).toBeTruthy();
    expect(dialogElement().classList.contains('block')).toBe(true);
  });

  it('RF-14 (019) · 14.3, D-T8 (019): lo escrito sobrevive a cerrar y volver a abrir', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.type(screen.getByLabelText('Texto'), 'a medias');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect((screen.getByLabelText('Texto') as HTMLInputElement).value).toBe('a medias');
  });

  it('RF-14 (019) · 14.3, D-T8 (019): el evento `close` del navegador llega a onClose y cierra', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent(dialogElement(), new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('D-T8 (019): cerrar desde el estado no repite onClose', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('RF-14 (019) · 14.3, D-T8 (019): al cerrarse, el foco vuelve al control que lo abrió', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    opener.focus();
    await userEvent.click(opener);
    screen.getByLabelText('Texto').focus();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(document.activeElement).toBe(opener);
  });

  it('RF-14 (019) · 14.2, D-T8 (019): Tab en el último control vuelve al primero y Mayús+Tab en el primero va al último', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const field = screen.getByLabelText('Texto');
    const close = screen.getByRole('button', { name: 'Cerrar' });
    close.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(field);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(close);
  });

  it('D-T8 (019): con dismissible={false}, cancel se cancela y no se avisa', async () => {
    const onClose = vi.fn();
    render(<Harness dismissible={false} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialogElement(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('D-T8 (019): con dismissible, cancel sigue su curso', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialogElement(), cancel);
    expect(cancel.defaultPrevented).toBe(false);
  });

  it('D-T8 (019): con dismissible={false}, si el navegador lo cierra con open en true, se vuelve a abrir', async () => {
    const onClose = vi.fn();
    render(<Harness dismissible={false} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    dialogElement().removeAttribute('open');
    fireEvent(dialogElement(), new Event('close'));
    expect(dialogElement().hasAttribute('open')).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
