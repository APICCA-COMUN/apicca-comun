// Diálogos en Chromium real (RF-14 (019), D-T8 (019)). `Dialog` usa el `<dialog>` nativo con `showModal()`:
// - RF-14 (019) · 14.1: vela el fondo con `veil` (`::backdrop`), lo vuelve inerte y la página no se desplaza;
// - RF-14 (019) · 14.2: Tab y Mayús+Tab dan la vuelta dentro del diálogo;
// - RF-14 (019) · 14.3: al cerrarse, el foco vuelve al control que lo abrió;
// - D-T8 (019): Esc cierra los diálogos que se pueden descartar y avisa con `onClose`; con `dismissible={false}`
//   (la reautenticación) dos Esc seguidos no lo cierran.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { THEMES, TOKENS } from '../../shared/domain/identity';
import { Dialog } from '../../src/components/Dialog';

let host: HTMLDivElement | undefined;
let root: Root | undefined;

async function actNow(run: () => void | Promise<void>) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      await run();
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

const settle = () => new Promise((done) => setTimeout(done, 50));

/** Un botón que abre el diálogo, un campo fuera y una página alta, para probar el desplazamiento. */
function Harness({ dismissible, onClose }: { dismissible?: boolean; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minBlockSize: '3000px' }}>
      <button type="button" className="block action-secondary" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <input aria-label="Campo de fondo" className="block" />
      <Dialog
        open={open}
        labelledBy="dialog-title"
        {...(dismissible === undefined ? {} : { dismissible })}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      >
        <h2 id="dialog-title">Un diálogo</h2>
        <label>
          Texto
          <input className="block" />
        </label>
        <button type="button" className="block action-secondary" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </Dialog>
    </div>
  );
}

async function mount(props: { dismissible?: boolean } = {}) {
  const onClose = vi.fn();
  const mounted = root!;
  await actNow(() => mounted.render(<Harness {...props} onClose={onClose} />));
  const opener = [...host!.querySelectorAll('button')].find((button) => button.textContent === 'Abrir')!;
  opener.focus();
  await userEvent.click(opener);
  await settle();
  const dialog = host!.querySelector('dialog')!;
  return { onClose, opener, dialog };
}

const rgba = (value: string) => value.replace(/\s+/g, ' ');

beforeAll(async () => {
  await page.viewport(1280, 800);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  const mounted = root!;
  await actNow(() => mounted.render(<></>));
  delete document.documentElement.dataset['theme'];
  scrollTo(0, 0);
});

afterAll(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
});

describe('Dialog', () => {
  it.each(THEMES)('RF-14 (019) · 14.1, D-T8 (019): en el tema %s, el diálogo es modal y vela el fondo con veil', async (theme) => {
    document.documentElement.dataset['theme'] = theme;
    const { dialog } = await mount();
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('dialog-title');
    const veil = getComputedStyle(dialog, '::backdrop').backgroundColor;
    const expected = TOKENS[theme].veil.replace(/^rgb\((\d+) (\d+) (\d+) \/ (\.?\d+)\)$/, (_m, r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${Number(a)})`);
    expect(rgba(veil)).toBe(expected);
  });

  it('RF-14 (019) · 14.1, D-T8 (019): con el diálogo abierto, el fondo no recibe el puntero ni se desplaza', async () => {
    const { dialog } = await mount();
    const field = host!.querySelector<HTMLInputElement>('input[aria-label="Campo de fondo"]')!;
    const box = field.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    expect(hit === field || field.contains(hit)).toBe(false);
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden');
    dialog.close();
    await settle();
    expect(getComputedStyle(document.documentElement).overflow).not.toBe('hidden');
  });

  it('RF-14 (019) · 14.2, D-T8 (019): Tab y Mayús+Tab dan la vuelta sin salir del diálogo', async () => {
    const { dialog } = await mount();
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement), `Tab ${step + 1}: ${document.activeElement?.outerHTML.slice(0, 60)}`).toBe(true);
    }
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `Mayús+Tab ${step + 1}: ${document.activeElement?.outerHTML.slice(0, 60)}`).toBe(true);
    }
  });

  it('RF-14 (019) · 14.3, D-T8 (019): al cerrarse con un botón, el foco vuelve al control que lo abrió', async () => {
    const { dialog, opener } = await mount();
    const close = [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Cerrar')!;
    await userEvent.click(close);
    await settle();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('RF-14 (019) · 14.3, D-T8 (019): Esc cierra el diálogo, avisa con onClose y devuelve el foco', async () => {
    const { dialog, opener, onClose } = await mount();
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('RF-14 (019) · 14.1, D-T8 (019): con dismissible={false}, dos Esc seguidos no lo cierran ni avisan', async () => {
    const { dialog, onClose } = await mount({ dismissible: false });
    await userEvent.keyboard('{Escape}');
    await settle();
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
