// RF-3 (001), RF-5 (001) · Estado de sesión de la app: Auth más la propia cuenta `accounts/{uid}`.
// Sin proveedor, o sin fuente de sesión, es la de visitante. La fuente es inyectable para probar con dobles.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AccountDoc, Role } from '../../shared/domain/accounts';

export type SessionState =
  /** Resolviendo la sesión; las guardas no deben redirigir mientras dura. */
  | { status: 'loading' }
  | { status: 'visitor' }
  | { status: 'person'; uid: string; role: Role; username: string }
  /** Con sesión de Auth pero cuenta suspendida (RF-5 (001)): solo puede ver el aviso y salir. */
  | { status: 'suspended'; uid: string };

export type PersonSession = Extract<SessionState, { status: 'person' }>;

export const VISITOR: SessionState = { status: 'visitor' };

/** De dónde sale la sesión: Auth, la propia cuenta y cerrar sesión. */
export interface SessionSource {
  /** Avisa el uid de quien tiene sesión, o `null`; devuelve cómo dejar de escuchar. */
  onAuth(callback: (uid: string | null) => void): () => void;
  /** Escucha `accounts/{uid}`; `null` mientras el documento no existe o no se puede leer. */
  onAccount(uid: string, callback: (account: AccountDoc | null) => void): () => void;
  signOut(): Promise<void>;
}

export const SessionContext = createContext<SessionState>(VISITOR);
const SignOutContext = createContext<() => Promise<void>>(() => Promise.resolve());

/** Sesión actual. Sin proveedor es la de visitante. */
export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** Cierra la sesión; sin fuente de sesión no hace nada. */
export function useSignOut(): () => Promise<void> {
  return useContext(SignOutContext);
}

/** Hay una persona con sesión iniciada y cuenta activa. */
export function isSignedIn(session: SessionState): session is PersonSession {
  return session.status === 'person';
}

function stateOf(uid: string, account: AccountDoc | null): SessionState {
  if (account === null) return { status: 'loading' };
  if (account.status === 'suspended') return { status: 'suspended', uid };
  return { status: 'person', uid, role: account.role, username: account.username };
}

export function SessionProvider({
  children,
  initial = VISITOR,
  source,
}: {
  children: ReactNode;
  /** Sesión de partida; útil en pruebas. Con `source`, la sesión parte cargando. */
  initial?: SessionState;
  source?: SessionSource;
}) {
  const [session, setSession] = useState<SessionState>(source ? { status: 'loading' } : initial);

  useEffect(() => {
    if (!source) return;
    let stopAccount: (() => void) | undefined;
    const stopAuth = source.onAuth((uid) => {
      stopAccount?.();
      stopAccount = undefined;
      if (uid === null) {
        setSession(VISITOR);
        return;
      }
      setSession({ status: 'loading' });
      stopAccount = source.onAccount(uid, (account) => setSession(stateOf(uid, account)));
    });
    return () => {
      stopAuth();
      stopAccount?.();
    };
  }, [source]);

  const signOut = useCallback(() => (source ? source.signOut() : Promise.resolve()), [source]);

  return (
    <SessionContext.Provider value={source ? session : initial}>
      <SignOutContext.Provider value={signOut}>{children}</SignOutContext.Provider>
    </SessionContext.Provider>
  );
}
