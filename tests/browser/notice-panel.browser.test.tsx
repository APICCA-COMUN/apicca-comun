// RF-6 (024) · 6.1, RNF-5 (012), D-T11 (012), RF-12 (021) · 12.5 · El panel de avisos de la barra del mapa (antes, de Mi tablero) se ve entero y legible en Chromium real: queda dentro
// de la ventana y mide 360 px, o el ancho de la ventana menos 32 px si es menor.
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { SessionProvider, type SessionState } from '../../src/app/session';
import { Play } from '../../src/pages/Play';
import { NO_NOTICE } from '../../src/data/constitution/notice';
import type { Notice } from '../../shared/domain/notices';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
/** Un aviso con fecha, para comprobar que la fecha cabe en el panel (RF-6 (024) · 6.1). */
const NOTICE: Notice = { id: 'a', type: 'apice-editado', at: Date.parse('2026-11-03T15:00:00Z'), href: '/apices/a1', actor: 'beto', subject: 'Huerta' };

let bench: HTMLDivElement | undefined;

afterEach(async () => {
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

/** Monta el mapa sin avisos, como en la revisión del 15 de octubre de 2026, y abre la campana. */
async function openPanel(width: number, notices: Notice[] = []): Promise<DOMRect> {
  await page.viewport(width, 800);
  history.replaceState(null, '', '/');
  bench = document.createElement('div');
  document.body.append(bench);
  const root = createRoot(bench);
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      root.render(
        <SessionProvider initial={PERSON}>
          <main>
            <Play
              source={{ fetchPage: async () => ({ items: [], cursor: null }) }}
              noticeSource={{ fetchNotice: async () => NO_NOTICE }}
              noticesSource={{ fetchNotices: async () => ({ notices, seenAt: null }) }}
            />
          </main>
        </SessionProvider>,
      );
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = false;
  }
  await userEvent.click(page.getByRole('button', { name: /^Avisos/ }));
  const find = () => bench!.querySelector<HTMLElement>('section[aria-label="Avisos"]');
  await expect.poll(find).toBeTruthy();
  return find()!.getBoundingClientRect();
}

describe.each([360, 768, 1280])('panel de avisos a %i px', (width) => {
  it('RNF-5 (012): el panel queda entero dentro de la ventana', async () => {
    const rect = await openPanel(width);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
  });

  it('RNF-5 (012): el panel mide 360 px, o el ancho de la ventana menos 32 px si es menor', async () => {
    const rect = await openPanel(width);
    expect(rect.width).toBeCloseTo(Math.min(360, window.innerWidth - 32), 0);
  });
});

describe.each([360, 768, 1280])('fecha de los avisos a %i px', (width) => {
  it('RF-6 (024) · 6.1: la fecha larga de cada aviso cabe dentro del panel', async () => {
    const rect = await openPanel(width, [NOTICE]);
    const time = bench!.querySelector<HTMLElement>('.notice-panel time');
    expect(time).toBeTruthy();
    const timeRect = time!.getBoundingClientRect();
    expect(timeRect.left).toBeGreaterThanOrEqual(rect.left);
    expect(timeRect.right).toBeLessThanOrEqual(rect.right);
    expect(time!.textContent).toBe('3 de noviembre de 2026');
  });
});
