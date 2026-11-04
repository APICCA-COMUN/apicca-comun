// Flujos de los diálogos en Chromium real (RF-14 (019), D-T8 (019)):
// - RF-14 (019) · 14.1: dos Esc seguidos en la reautenticación la dejan abierta y el texto sigue en memoria;
// - RF-14 (019) · 14.3: Esc en un diálogo con formulario, y volver a abrirlo, conserva lo escrito;
// - D-T8 (019): solo «Cancelar» descarta lo escrito.
// La reautenticación se monta con una sesión doble, sin siembra; «Nuevo documento» usa la siembra completa y la
// cuenta de Facilitación sobre `App`.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/fonts.css';
import '../../src/styles/base.css';
import '../../src/styles/blocks.css';
import '../../src/styles/lots.css';
import { App } from '../../src/App';
import { createDrafts, DraftsContext, useDraft } from '../../src/app/drafts';
import { SessionProvider, type SessionSource } from '../../src/app/session';
import { AuthServiceContext, type AuthService } from '../../src/data/authService';
import { firebaseSessionSource } from '../../src/data/sessionSource';
import { ReauthDialog } from '../../src/components/ReauthDialog';
import { signInAs, signOutNow } from './session';
import { FACILITATOR } from './seed-data';

let host: HTMLDivElement | undefined;
let root: Root | undefined;
let signedIn = false;

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
  for (let attempt = 0; attempt * 50 <= timeoutMs; attempt += 1) {
    const found = find();
    if (found !== null && found !== undefined && found !== false) return found;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('waitFor: se agotó la espera.');
}

const settle = () => new Promise((done) => setTimeout(done, 100));

beforeAll(async () => {
  await page.viewport(1280, 800);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  const mounted = root!;
  await actNow(() => mounted.render(<></>));
  if (signedIn) {
    await signOutNow();
    signedIn = false;
  }
});

afterAll(async () => {
  const mounted = root;
  if (mounted !== undefined) await actNow(() => mounted.unmount());
  host?.remove();
});

function Editor() {
  const [text, setText] = useDraft('ficha');
  return <textarea aria-label="Ficha" value={text} onChange={(event) => setText(event.target.value)} />;
}

/** Sesión doble: una persona entra y la prueba la termina cuando quiere. */
function sessionDouble() {
  let emitAuth: (uid: string | null) => void = () => undefined;
  const source: SessionSource = {
    onAuth: (callback) => {
      emitAuth = callback;
      callback('u1');
      return () => undefined;
    },
    onAccount: (uid, callback) => {
      callback({ email: `${uid}@ejemplo.org`, name: uid, username: uid, role: 'member', status: 'active' });
      return () => undefined;
    },
    signOut: () => Promise.resolve(),
  };
  return { source, endSession: () => actNow(() => emitAuth(null)) };
}

const noAuth = {
  signIn: vi.fn(() => Promise.resolve()),
  sendReset: vi.fn(() => Promise.resolve()),
  verifyResetCode: vi.fn(() => Promise.resolve('ana@ejemplo.org')),
  confirmReset: vi.fn(() => Promise.resolve()),
} as AuthService;

describe('Diálogos · flujos', () => {
  it('RF-14 (019) · 14.1, D-T8 (019): dos Esc seguidos en la reautenticación dejan el diálogo abierto y el texto en memoria', async () => {
    const { source, endSession } = sessionDouble();
    const drafts = createDrafts();
    const mounted = root!;
    await actNow(() =>
      mounted.render(
        <AuthServiceContext.Provider value={noAuth}>
          <DraftsContext.Provider value={drafts}>
            <SessionProvider source={source}>
              <Editor />
              <ReauthDialog />
            </SessionProvider>
          </DraftsContext.Provider>
        </AuthServiceContext.Provider>,
      ),
    );
    const field = host!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Ficha"]')!;
    await userEvent.fill(field, 'agua para todas');
    await endSession();
    const dialog = await waitFor(() => host!.querySelector<HTMLDialogElement>('dialog[open]'));
    expect(dialog.matches(':modal')).toBe(true);

    await userEvent.keyboard('{Escape}');
    await settle();
    await userEvent.keyboard('{Escape}');
    await settle();

    expect(dialog.isConnected).toBe(true);
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    expect(field.value).toBe('agua para todas');
    expect(drafts.hasAny()).toBe(true);
  });

  /** Monta la Constitución como Facilitación y abre «Nuevo documento». */
  async function openNewDocument() {
    await commands.seedFull();
    await signInAs(FACILITATOR);
    signedIn = true;
    await settle();
    history.replaceState(null, '', '/constitucion');
    dispatchEvent(new PopStateEvent('popstate'));
    const mounted = root!;
    await actNow(() =>
      mounted.render(
        <SessionProvider source={firebaseSessionSource}>
          <App />
        </SessionProvider>,
      ),
    );
    return waitFor(() => [...host!.querySelectorAll('button')].find((button) => button.textContent === 'Nuevo documento' && !button.closest('dialog')));
  }

  const dialogOf = () => host!.querySelector<HTMLDialogElement>('dialog[aria-labelledby="new-document-title"]')!;
  const fieldsOf = () => ({
    title: dialogOf().querySelector<HTMLInputElement>('input')!,
    text: dialogOf().querySelector<HTMLTextAreaElement>('textarea')!,
  });

  it('RF-14 (019) · 14.3, D-T8 (019): Esc en un diálogo con formulario, y volver a abrirlo, conserva lo escrito', async () => {
    const opener = await openNewDocument();
    await userEvent.click(opener);
    await waitFor(() => dialogOf().open);
    await userEvent.fill(fieldsOf().title, 'Cuidados del agua');
    await userEvent.fill(fieldsOf().text, 'Primero escuchamos.');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => !dialogOf().open);
    expect(document.activeElement).toBe(opener);

    await userEvent.click(opener);
    await waitFor(() => dialogOf().open);
    expect(fieldsOf().title.value).toBe('Cuidados del agua');
    expect(fieldsOf().text.value).toBe('Primero escuchamos.');
  });

  it('D-T8 (019): «Cancelar» descarta lo escrito', async () => {
    const opener = await openNewDocument();
    await userEvent.click(opener);
    await waitFor(() => dialogOf().open);
    await userEvent.fill(fieldsOf().title, 'Un borrador');
    await userEvent.fill(fieldsOf().text, 'Texto a medias.');

    const cancel = [...dialogOf().querySelectorAll('button')].find((button) => button.textContent === 'Cancelar')!;
    await userEvent.click(cancel);
    await waitFor(() => !dialogOf().open);

    await userEvent.click(opener);
    await waitFor(() => dialogOf().open);
    expect(fieldsOf().title.value).toBe('');
    expect(fieldsOf().text.value).toBe('');
  });
});
