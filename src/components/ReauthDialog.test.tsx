import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createDrafts, DraftsContext, useDraft } from '../app/drafts';
import { SessionProvider, type SessionSource } from '../app/session';
import { AuthServiceContext } from '../data/authService';
import { authError, fakeAuth } from '../testing/fakeAuth';
import { expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary, primaryActions } from '../testing/expectActions';
import { ReauthDialog } from './ReauthDialog';

/** Auth doble con sesión controlable desde la prueba. */
function sessionHarness(uid: string | null = 'u1') {
  let emitAuth: (uid: string | null) => void = () => undefined;
  const source: SessionSource = {
    onAuth: (cb) => {
      emitAuth = cb;
      cb(uid);
      return () => undefined;
    },
    onAccount: (u, cb) => {
      cb({ email: `${u}@ejemplo.org`, name: u, username: u, role: 'member', status: 'active' });
      return () => undefined;
    },
    signOut: () => Promise.resolve(),
  };
  return { source, setUid: (next: string | null) => act(() => emitAuth(next)) };
}

function Editor() {
  const [text, setText] = useDraft('ficha');
  return <textarea aria-label="Ficha" value={text} onChange={(e) => setText(e.target.value)} />;
}

function setup(auth = fakeAuth()) {
  const harness = sessionHarness();
  const drafts = createDrafts();
  render(
    <AuthServiceContext.Provider value={auth}>
      <DraftsContext.Provider value={drafts}>
        <SessionProvider source={harness.source}>
          <Editor />
          <ReauthDialog />
        </SessionProvider>
      </DraftsContext.Provider>
    </AuthServiceContext.Provider>,
  );
  return { ...harness, drafts, auth };
}

describe('ReauthDialog', () => {
  it('RF-3 (001): al terminar la sesión con un texto a medias pide entrar y, al reautenticar, el texto sigue ahí', async () => {
    const { setUid, auth } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'agua para todas');
    await setUid(null);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/sesión terminó/);
    expect((screen.getByLabelText('Ficha') as HTMLTextAreaElement).value).toBe('agua para todas');

    await user.type(screen.getByLabelText('Correo'), 'u1@ejemplo.org');
    await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(auth.signIn).toHaveBeenCalledWith('u1@ejemplo.org', 'una-clave-larga');
    await setUid('u1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByLabelText('Ficha') as HTMLTextAreaElement).value).toBe('agua para todas');
  });

  it('RF-3 (001): sin nada escrito no interrumpe', async () => {
    const { setUid } = setup();
    await setUid(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('RF-3 (001): un fallo al entrar se informa sin cerrar el diálogo ni perder el texto', async () => {
    const { setUid } = setup(fakeAuth({ signIn: () => Promise.reject(authError('auth/invalid-credential')) }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'texto');
    await setUid(null);
    await user.type(await screen.findByLabelText('Correo'), 'u1@ejemplo.org');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/correo o la contraseña/);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('RNF-10 (001): si entra otra persona, el texto de la anterior se descarta', async () => {
    const { setUid, drafts } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'texto de ana');
    await setUid(null);
    await screen.findByRole('dialog');
    await setUid('u2');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(drafts.hasAny()).toBe(false);
  });

  it('RNF-10 (001): «Descartar y salir» borra lo escrito y cierra el diálogo', async () => {
    const { setUid, drafts } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'texto');
    await setUid(null);
    await user.click(await screen.findByRole('button', { name: 'Descartar y salir' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(drafts.hasAny()).toBe(false);
  });

  it('RF-6 (002) · 6.1, 6.3: el diálogo y sus controles son bloques; «Descartar y salir» es secundaria (la 001 no la confirma)', async () => {
    const { setUid } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'texto');
    await setUid(null);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.classList.contains('block')).toBe(true);
    expect(screen.getByRole('button', { name: 'Entrar' }).className).toBe('block action-primary');
    expect(screen.getByRole('button', { name: 'Descartar y salir' }).className).toBe('block action-secondary');
    expectBlocks(dialog);
  });

  it('RF-4 (003) · 4.7: con el diálogo abierto sobre un formulario, primaryActions solo cuenta «Entrar» del diálogo y «Descartar y salir» es secundaria', async () => {
    const harness = sessionHarness();
    const drafts = createDrafts();
    render(
      <AuthServiceContext.Provider value={fakeAuth()}>
        <DraftsContext.Provider value={drafts}>
          <SessionProvider source={harness.source}>
            <form>
              <Editor />
              <button type="button" className="block action-primary">Guardar</button>
            </form>
            <ReauthDialog />
          </SessionProvider>
        </DraftsContext.Provider>
      </AuthServiceContext.Provider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'texto');
    await harness.setUid(null);
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Descartar y salir' }).className).toBe('block action-secondary');
    expect(primaryActions(document.body).map((b) => b.textContent?.trim())).toEqual(['Entrar']);
    expectOnePrimary(document.body, 'Entrar');
  });

  it('RF-3 (003) · 3.3: el diálogo no contiene bloques anidados', async () => {
    const { setUid } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ficha'), 'texto');
    await setUid(null);
    const dialog = await screen.findByRole('dialog');
    expectBlocks(dialog, { nesting: true });
  });
});
