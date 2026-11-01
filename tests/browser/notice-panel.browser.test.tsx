// RNF-5 (012), D-T11 (012) · El panel de avisos de Mi tablero se ve entero y legible en Chromium real: queda dentro
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
import { Dashboard } from '../../src/pages/Dashboard';
import { NO_NOTICE } from '../../src/data/constitution/notice';

const PERSON: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };

let bench: HTMLDivElement | undefined;

afterEach(async () => {
  bench?.remove();
  bench = undefined;
  await page.viewport(1280, 800);
});

/** Monta Mi tablero sin avisos, como en la revisión del 15 de octubre de 2026, y abre la campana. */
async function openPanel(width: number): Promise<DOMRect> {
  await page.viewport(width, 800);
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
            <Dashboard
              source={{ fetchPage: async () => ({ items: [], cursor: null }) }}
              noticeSource={{ fetchNotice: async () => NO_NOTICE }}
              noticesSource={{ fetchNotices: async () => ({ notices: [], seenAt: null }) }}
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
