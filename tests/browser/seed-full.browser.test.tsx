// La siembra completa contra los emuladores (T-8.1, RNF-5 (002), RF-13 (002), D-T13 (002); Mi tablero, RF-11 (003)): con la autora y la
// facilitación dentro del emulador de Auth, las rutas que piden sesión se montan sin redirigir, y las cuatro
// etiquetas de condición (D-T17 (002)) aparecen en sus ápices.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import { App } from '../../src/App';
import { SessionProvider } from '../../src/app/session';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { signInAs, signOutNow } from './session';
import { APICE_IDS, AUTHOR, CONDITION_TEXTS, FACILITATOR, INVITED_EMAIL } from './seed-data';

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let previousPath: string;

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

async function show(path: string) {
  history.replaceState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() => !host!.textContent!.includes('Cargando') && host!.querySelector('main h1, main h2'));
}

const tag = (condition: string, text: string) =>
  [...host!.querySelectorAll<HTMLElement>(`.tag[data-condition="${condition}"]`)].find((el) => el.textContent === text);

beforeAll(async () => {
  await commands.seedFull();
  previousPath = location.pathname + location.search;
  history.replaceState(null, '', '/');
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
});

afterAll(async () => {
  await signOutNow();
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
  history.replaceState(null, '', previousPath);
});

describe('con la autora', () => {
  beforeAll(async () => {
    await signInAs(AUTHOR);
  });

  it('RNF-5 (002): /apices/:id/editar monta la edición sin redirigir', async () => {
    await show(`/apices/${APICE_IDS.withImage}/editar`);
    expect(location.pathname).toBe(`/apices/${APICE_IDS.withImage}/editar`);
    await waitFor(() => host!.querySelector('main form'));
    expect(host!.querySelector('main')!.textContent).not.toContain('Sitio en construcción');
  });

  it('RF-13 (002) · 13.1, 13.3: el estado aparece como etiqueta en el ápice con imagen', async () => {
    await show(`/apices/${APICE_IDS.withImage}`);
    await waitFor(() => tag('status', CONDITION_TEXTS.status));
    const image = await waitFor(() => host!.querySelector<HTMLImageElement>('img.pixel-image'));
    await waitFor(() => image.complete && image.naturalWidth > 0);
    expect([image.naturalWidth, image.naturalHeight]).toEqual([64, 64]);
  });

  it('RF-13 (002) · 13.1, 13.3: la visibilidad privada aparece como etiqueta en el ápice privado', async () => {
    await show(`/apices/${APICE_IDS.private}`);
    await waitFor(() => tag('visibility', CONDITION_TEXTS.private));
  });

  it('RF-13 (002) · 13.1, 13.3: el archivo aparece como etiqueta en el ápice archivado', async () => {
    await show(`/apices/${APICE_IDS.archived}`);
    await waitFor(() => tag('archived', CONDITION_TEXTS.archived));
  });

  it('RNF-5 (002): los ápices de cinco ejes y con propuesta pendiente se montan con su contenido', async () => {
    await show(`/apices/${APICE_IDS.allAxes}`);
    await waitFor(() => host!.querySelectorAll('[aria-label="Ejes"] li').length === 5);
    await show(`/apices/${APICE_IDS.withProposal}`);
    await waitFor(() => host!.querySelector('main section[aria-label]') !== null);
    expect(host!.querySelector('main')!.textContent).not.toContain('Sitio en construcción');
  });
  it('RF-11 (003) · 11.1, 11.2: /tablero saluda a la autora con su @usuario, lista sus ápices y no el archivado (D-T22 (003))', async () => {
    await show('/tablero');
    expect(location.pathname).toBe('/tablero');
    await waitFor(() => host!.querySelector('main h1')?.textContent === `Hola, @${AUTHOR.username}`);
    const main = host!.querySelector('main')!;
    await waitFor(() => main.textContent!.includes('Huerta con imagen'));
    for (const name of ['Huerta con imagen', 'Los cinco ejes', 'Ápice privado']) expect(main.textContent).toContain(name);
    expect(main.textContent).not.toContain('Ápice archivado');
  });
});

describe('con la facilitación', () => {
  beforeAll(async () => {
    await signOutNow();
    await signInAs(FACILITATOR);
  });

  it('RNF-5 (002): /facilitacion/invitaciones monta la lista con la invitación pendiente sin redirigir', async () => {
    await show('/facilitacion/invitaciones');
    expect(location.pathname).toBe('/facilitacion/invitaciones');
    await waitFor(() => host!.textContent!.includes(INVITED_EMAIL));
    expect(host!.querySelector('main')!.textContent).toContain('Pendiente');
  });

  it('RF-13 (002) · 13.1, 13.3: la referencia retirada aparece como etiqueta en su ápice', async () => {
    await show(`/apices/${APICE_IDS.withRetractedReference}`);
    await waitFor(() => tag('reference', CONDITION_TEXTS.retracted));
  });
});
