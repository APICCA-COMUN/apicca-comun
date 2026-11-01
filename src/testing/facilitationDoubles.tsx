// Dobles para probar las páginas de facilitación: una fuente de listas que se puede cambiar y un cliente de ops
// que registra las llamadas. No son una prueba: ningún `it` cita requisitos.
import type { ReactNode } from 'react';
import { SessionProvider } from '../app/session';
import type { ApiOps } from '../data/api';
import type { AccountRow, EnrollmentRow, FacilitationSource, InvitationRow } from '../data/facilitation';
import type { OpClient } from '../data/api';

export const at = (iso: string) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 });

export function fakeSource(initial: { invitations?: InvitationRow[]; enrollments?: EnrollmentRow[]; accounts?: AccountRow[] } = {}) {
  const state = { invitations: initial.invitations ?? [], enrollments: initial.enrollments ?? [], accounts: initial.accounts ?? [] };
  const listeners = { invitations: new Set<(rows: never[]) => void>(), enrollments: new Set<(rows: never[]) => void>(), accounts: new Set<(rows: never[]) => void>() };
  const watch = (key: keyof typeof state) => (callback: (rows: never[]) => void) => {
    listeners[key].add(callback);
    callback(state[key] as never[]);
    return () => listeners[key].delete(callback);
  };
  const source: FacilitationSource = {
    onInvitations: watch('invitations'),
    onEnrollments: watch('enrollments'),
    onAccounts: watch('accounts'),
  } as FacilitationSource;
  const set = (key: keyof typeof state, rows: unknown[]) => {
    state[key] = rows as never;
    for (const listener of listeners[key]) listener(rows as never[]);
  };
  return {
    source,
    setInvitations: (rows: InvitationRow[]) => set('invitations', rows),
    setEnrollments: (rows: EnrollmentRow[]) => set('enrollments', rows),
    setAccounts: (rows: AccountRow[]) => set('accounts', rows),
  };
}

type Handlers = { [K in keyof ApiOps]?: (payload: ApiOps[K]['in']) => ApiOps[K]['out'] | Promise<ApiOps[K]['out']> };

export function fakeClient(handlers: Handlers) {
  const calls: Array<{ op: string; payload: unknown }> = [];
  const client = {
    async call(op: string, payload: unknown) {
      calls.push({ op, payload });
      const handler = (handlers as Record<string, ((p: unknown) => unknown) | undefined>)[op];
      if (handler === undefined) throw new Error(`op sin doble: ${op}`);
      return handler(payload);
    },
  } as OpClient<ApiOps>;
  return { client, calls };
}

export function AsFacilitator({ children, uid = 'fab' }: { children: ReactNode; uid?: string }) {
  return <SessionProvider initial={{ status: 'person', uid, role: 'facilitator', username: 'fabi' }}>{children}</SessionProvider>;
}
