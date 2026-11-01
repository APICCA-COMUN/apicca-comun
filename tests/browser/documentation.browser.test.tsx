// RF-14 (003) · 14.2, 14.3, RF-16 (003) · 16.3 · Documentación en Chromium real, ruta `/documentacion`: la columna del
// artículo mide 680 px como máximo, el índice va antes del artículo bajo 720 px y a un lado a 1280 px, y a 360 px no
// hay desplazamiento horizontal. Se repite en los dos temas.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let previousPath = '';

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

async function waitFor<T>(find: () => T | null | undefined | false, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    if (Date.now() > until) throw new Error('waitFor: se agotó la espera.');
    await new Promise((done) => setTimeout(done, 50));
  }
}

async function open(path: string) {
  history.replaceState(null, '', path);
  host = document.createElement('div');
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await actNow(() =>
    created.render(
      <SessionProvider source={firebaseSessionSource}>
        <App />
      </SessionProvider>,
    ),
  );
}

beforeAll(async () => {
  await commands.seedPartial();
  previousPath = location.pathname + location.search;
});

afterEach(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  history.replaceState(null, '', previousPath);
  await page.viewport(1280, 800);
});

describe.each(['light', 'dark'] as const)('documentación en el tema %s (003)', (theme) => {
  async function openDocs(width: number) {
    document.documentElement.dataset['theme'] = theme;
    await page.viewport(width, 800);
    await open('/documentacion');
    const article = await waitFor(() => host!.querySelector<HTMLElement>('main .documentation__article'));
    const index = host!.querySelector<HTMLElement>('main .documentation__index')!;
    return { article, index };
  }

  it('RF-14 (003) · 14.2: la columna del artículo mide 680 px como máximo a 1280 px', async () => {
    const { article } = await openDocs(1280);
    expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(680 + 0.5);
  });

  it('RF-14 (003) · 14.3: a 1280 px el índice va a un lado del artículo', async () => {
    const { article, index } = await openDocs(1280);
    const a = article.getBoundingClientRect();
    const i = index.getBoundingClientRect();
    expect(i.right).toBeLessThanOrEqual(a.left + 0.5);
    expect(Math.abs(i.top - a.top)).toBeLessThan(a.height);
  });

  it('RF-14 (003) · 14.3: a 360 px el índice va antes del artículo, en el DOM y en la pantalla', async () => {
    const { article, index } = await openDocs(360);
    expect(index.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(index.getBoundingClientRect().bottom).toBeLessThanOrEqual(article.getBoundingClientRect().top + 0.5);
  });

  it('RF-16 (003) · 16.3: a 360 px no hay desplazamiento horizontal', async () => {
    await openDocs(360);
    const doc = document.documentElement;
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
  });
});
