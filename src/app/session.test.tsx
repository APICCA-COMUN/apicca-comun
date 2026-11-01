import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { messageFor } from '../../shared/domain/messages';
import type { AccountDoc } from '../../shared/domain/accounts';
import { App } from '../App';
import {
  isSignedIn,
  SessionProvider,
  useSession,
  useSignOut,
  VISITOR,
  type SessionSource,
  type SessionState,
} from './session';

describe('la sesión', () => {
  it('sin proveedor es la de visitante', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current).toEqual(VISITOR);
  });

  it('el proveedor sin sesión inicial entrega visitante', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.status).toBe('visitor');
  });

  it('el proveedor entrega la sesión inicial que recibe', () => {
    const initial: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SessionProvider initial={initial}>{children}</SessionProvider>
    );
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current).toEqual(initial);
  });

  it('isSignedIn distingue a la persona del visitante, de la carga y de la suspendida', () => {
    expect(isSignedIn({ status: 'person', uid: 'u1', role: 'member', username: 'ana' })).toBe(true);
    expect(isSignedIn(VISITOR)).toBe(false);
    expect(isSignedIn({ status: 'loading' })).toBe(false);
    expect(isSignedIn({ status: 'suspended', uid: 'u1' })).toBe(false);
  });
});

/** Auth y cuenta dobles que la prueba mueve a mano. */
function fakeSource() {
  let authCb: (uid: string | null) => void = () => {};
  let accountCb: (account: AccountDoc | null) => void = () => {};
  const unsubAccount = vi.fn();
  const source: SessionSource = {
    onAuth: (cb) => {
      authCb = cb;
      return () => {};
    },
    onAccount: (_uid, cb) => {
      accountCb = cb;
      return unsubAccount;
    },
    signOut: vi.fn(() => {
      authCb(null);
      return Promise.resolve();
    }),
  };
  return {
    source,
    unsubAccount,
    signIn: (uid: string) => authCb(uid),
    setAccount: (account: AccountDoc | null) => accountCb(account),
  };
}

const ANA: AccountDoc = { email: 'ana@ejemplo.org', name: 'Ana', username: 'ana', role: 'member', status: 'active' };

function Probe() {
  const session = useSession();
  const signOut = useSignOut();
  return (
    <div>
      <p data-testid="estado">{session.status === 'person' ? `person:${session.role}:${session.username}` : session.status}</p>
      <button onClick={() => void signOut()}>Salir</button>
    </div>
  );
}

describe('la sesión sobre Auth y la propia cuenta', () => {
  it('RF-3 (001): carga hasta conocer la cuenta, luego es persona y al cerrar sesión pasa a visitante', async () => {
    const fake = fakeSource();
    render(
      <SessionProvider source={fake.source}>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId('estado').textContent).toBe('loading');
    act(() => fake.signIn('u1'));
    expect(screen.getByTestId('estado').textContent).toBe('loading');
    act(() => fake.setAccount(ANA));
    expect(screen.getByTestId('estado').textContent).toBe('person:member:ana');
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(fake.source.signOut).toHaveBeenCalledOnce();
    expect(screen.getByTestId('estado').textContent).toBe('visitor');
    expect(fake.unsubAccount).toHaveBeenCalled();
  });

  it('RF-3 (001): sin sesión de Auth el resultado es visitante', () => {
    const fake = fakeSource();
    render(
      <SessionProvider source={fake.source}>
        <Probe />
      </SessionProvider>,
    );
    act(() => fake.signIn(null as unknown as string));
    expect(screen.getByTestId('estado').textContent).toBe('visitor');
  });

  it('RF-5 (001): la persona que ya estaba dentro pasa a suspendida cuando su cuenta cambia, y se le avisa', () => {
    const fake = fakeSource();
    render(
      <SessionProvider source={fake.source}>
        <Probe />
        <App />
      </SessionProvider>,
    );
    act(() => fake.signIn('u1'));
    act(() => fake.setAccount({ ...ANA, role: 'facilitator' }));
    expect(screen.getByTestId('estado').textContent).toBe('person:facilitator:ana');
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => fake.setAccount({ ...ANA, status: 'suspended' }));
    expect(screen.getByTestId('estado').textContent).toBe('suspended');
    expect(screen.getByRole('alert').textContent).toContain(messageFor('account-suspended'));
  });

  it('RF-5 (001): la suspendida puede cerrar sesión desde el aviso', async () => {
    const fake = fakeSource();
    render(
      <SessionProvider source={fake.source}>
        <Probe />
        <App />
      </SessionProvider>,
    );
    act(() => fake.signIn('u1'));
    act(() => fake.setAccount({ ...ANA, status: 'suspended' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByTestId('estado').textContent).toBe('visitor');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
