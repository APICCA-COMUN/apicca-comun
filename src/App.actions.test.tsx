// RF-4 (003) · 4.2, 4.6, 4.10; RF-17 (003) · 17.3; RF-10 (003) · 10.2; RF-18 (003) · 18.2, 18.3; D-T5 (003): tabla de acciones por pantalla. Monta la `App` real
// en cada pantalla existente de §4.9 con su sesión, con dobles en memoria, y afirma el único botón azul (o su
// ausencia) con `expectOnePrimary` y la clase de cada acción nombrada. La tabla es el oráculo: las filas dicen lo
// que pide la spec, no lo que hoy pintan los componentes. T-4.23 suma Inicio, Prototipado y Mi tablero.
import './testing/appDoubles';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { SessionProvider, VISITOR, type SessionState } from './app/session';
import { api } from './data/api';
import { AuthServiceContext, type AuthService } from './data/authService';
import { firestoreHistorySource } from './data/versions';
import { expectOnePrimary } from './testing/expectActions';

const authDouble: AuthService = {
  signIn: async () => {},
  sendReset: async () => {},
  verifyResetCode: async () => 'ana@ejemplo.org',
  confirmReset: async () => {},
};

const FACILITATOR: SessionState = { status: 'person', uid: 'fab', role: 'facilitator', username: 'fabi' };

type ActionClass = 'action-primary' | 'action-secondary' | 'action-destructive';

interface Screen {
  /** Nombre de la pantalla en la tabla de §4.9. */
  screen: string;
  path: string;
  session: SessionState;
  /** Nombre del botón azul; `null` si la pantalla no tiene ninguno. */
  blue: string | null;
  /** Acciones con su clase esperada (sin repetir el botón azul). */
  actions: Array<[name: string, cls: ActionClass]>;
  /** Un texto que indica que la pantalla terminó de pintarse. */
  ready: RegExp;
}

export const SCREENS: Screen[] = [
  { screen: 'Entrar', path: '/entrar', session: VISITOR, blue: 'Entrar', actions: [], ready: /Entrar/ },
  { screen: 'Olvidé mi contraseña', path: '/olvide', session: VISITOR, blue: 'Enviar enlace', actions: [], ready: /Enviar enlace/ },
  {
    screen: 'Cambiar contraseña',
    path: '/accion?mode=resetPassword&oobCode=codigo',
    session: VISITOR,
    blue: 'Cambiar contraseña',
    actions: [],
    ready: /Cambiar contraseña/,
  },
  { screen: 'Registro con invitación', path: '/registro/tok-ejemplo', session: VISITOR, blue: 'Crear mi acceso', actions: [], ready: /Crear mi acceso/ },
  { screen: 'Solicitar inscripción', path: '/solicitar', session: VISITOR, blue: 'Enviar solicitud', actions: [], ready: /Enviar solicitud/ },
  { screen: 'Crear ápice', path: '/apices/nuevo', session: FACILITATOR, blue: 'Crear ápice', actions: [], ready: /Crear ápice/ },
  { screen: 'Editar ápice', path: '/apices/ejemplo/editar', session: FACILITATOR, blue: 'Guardar cambios', actions: [], ready: /Guardar cambios/ },
  {
    screen: 'Ficha del ápice',
    path: '/apices/ejemplo',
    session: FACILITATOR,
    blue: null,
    actions: [
      ['Generar imagen', 'action-secondary'],
      ['Subir referencia', 'action-secondary'],
      ['Archivar', 'action-secondary'],
    ],
    ready: /Generar imagen/,
  },
  {
    screen: 'Historial del ápice',
    path: '/apices/ejemplo/historial',
    session: FACILITATOR,
    blue: null,
    actions: [['Restaurar', 'action-secondary']],
    ready: /Restaurar/,
  },
  { screen: 'Archivados', path: '/archivados', session: FACILITATOR, blue: null, actions: [], ready: /Archivados/ },
  { screen: 'Facilitación · Invitaciones', path: '/facilitacion/invitaciones', session: FACILITATOR, blue: 'Invitar', actions: [], ready: /Invitar/ },
  {
    screen: 'Facilitación · Solicitudes',
    path: '/facilitacion/solicitudes',
    session: FACILITATOR,
    blue: null,
    actions: [
      ['Aceptar', 'action-secondary'],
      ['Descartar', 'action-destructive'],
    ],
    ready: /Sol Icita/,
  },
  {
    screen: 'Facilitación · Cuentas',
    path: '/facilitacion/cuentas',
    session: FACILITATOR,
    blue: null,
    actions: [['Suspender', 'action-secondary']],
    ready: /Suspender/,
  },
  // T-4.23: pantallas nuevas de §4.9. El Inicio ya no es el mapa (D-19 (003)): el mapa vive en Prototipado.
  { screen: 'Inicio sin sesión', path: '/', session: VISITOR, blue: 'Pide tu inscripción', actions: [], ready: /Pide tu inscripción/ },
  { screen: 'Inicio con sesión', path: '/', session: FACILITATOR, blue: 'Nuevo ápice', actions: [], ready: /Nuevo ápice/ },
  // Con el panel siempre a la vista (RF-7 (005) · 7.12), la edición rápida está abierta: «Guardar cambios» es el azul
  // y «Nuevo ápice» pasa a secundario (RF-7 (005) · 7.11).
  {
    screen: 'Prototipado con sesión',
    path: '/prototipado',
    session: FACILITATOR,
    blue: 'Guardar cambios',
    actions: [['Nuevo ápice', 'action-secondary']],
    ready: /Guardar cambios/,
  },
  { screen: 'Prototipado sin sesión', path: '/prototipado', session: VISITOR, blue: null, actions: [], ready: /Prototipado de ápices/ },
  {
    screen: 'Mi tablero',
    path: '/tablero',
    session: FACILITATOR,
    blue: 'Nuevo ápice',
    actions: [['Cerrar sesión', 'action-secondary']],
    ready: /Cerrar sesión/,
  },
];

function Frame({ session, children }: { session: SessionState; children: ReactNode }) {
  return (
    <AuthServiceContext.Provider value={authDouble}>
      <SessionProvider initial={session}>{children}</SessionProvider>
    </AuthServiceContext.Provider>
  );
}

async function mount(row: Screen): Promise<HTMLElement> {
  window.history.replaceState(null, '', row.path);
  render(
    <Frame session={row.session}>
      <App />
    </Frame>,
  );
  await waitFor(() => expect(screen.queryByText(/Cargando/)).toBeNull());
  const main = document.body.querySelector('main');
  if (main === null) throw new Error('La pantalla no pinta <main>.');
  await waitFor(() => expect(main.textContent ?? '').toMatch(row.ready));
  return main;
}

/** Los botones y enlaces de `<main>` cuyo nombre es exactamente `name`. */
function actionsNamed(main: HTMLElement, name: string): HTMLElement[] {
  return within(main)
    .queryAllByRole('button', { name })
    .concat(within(main).queryAllByRole('link', { name }));
}

// Los dobles de `appDoubles` no traen una invitación ni una versión anterior: se ajustan sobre sus objetos,
// sin tocar el archivo compartido (el `vi.mock` de `appDoubles` prevalece sobre uno local del mismo módulo).
beforeEach(() => {
  vi.spyOn(api, 'call').mockImplementation((async (op: string) => {
    if (op === 'inspectInvitation') return { state: 'pending', email: 'invitada@ejemplo.org', accountExists: false };
    throw new Error(`La prueba de acciones no debe llamar a la op ${op}.`);
  }) as unknown as typeof api.call);
  const stamp = { seconds: 1_790_000_000, nanoseconds: 0 };
  const content = { name: 'Huerta del barrio', description: 'Una huerta compartida.', axes: ['agua'], needs: '', offers: '', status: 'idea' };
  vi.spyOn(firestoreHistorySource, 'onApice').mockImplementation(((_id: string, callback: (head: unknown) => void) => {
    callback({ id: 'ejemplo', version: 2, visibility: 'public', isArchived: false, authorUid: 'fab' });
    return () => {};
  }) as unknown as typeof firestoreHistorySource.onApice);
  vi.spyOn(firestoreHistorySource, 'onVersions').mockImplementation(((_id: string, callback: (rows: unknown[]) => void) => {
    callback([
      { n: 2, kind: 'edit', restoredFromN: null, savedByUsername: 'fabi', savedAt: stamp, content },
      { n: 1, kind: 'create', restoredFromN: null, savedByUsername: 'fabi', savedAt: stamp, content },
    ]);
    return () => {};
  }) as unknown as typeof firestoreHistorySource.onVersions);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe.each(SCREENS)('acciones en $screen', (row) => {
  it(`RF-4 (003) · 4.2: ${row.screen} tiene ${row.blue === null ? 'ningún botón azul' : `un solo botón azul, «${row.blue}»`}`, async () => {
    const main = await mount(row);
    expectOnePrimary(main, row.blue);
  });

  it(`RF-4 (003) · 4.10: la acción principal de ${row.screen} es la de la tabla de §4.9`, async () => {
    const main = await mount(row);
    expectOnePrimary(document.body, row.blue);
    if (row.blue !== null) {
      const [button] = actionsNamed(main, row.blue);
      expect(button, `falta «${row.blue}»`).toBeDefined();
      expect(button?.classList.contains('action-primary')).toBe(true);
    }
  });

  if (row.actions.length > 0) {
    for (const [name, cls] of row.actions) {
      it(`RF-4 (003) · 4.6: en ${row.screen}, «${name}» lleva ${cls}`, async () => {
        const main = await mount(row);
        const found = actionsNamed(main, name);
        expect(found.length, `falta la acción «${name}»`).toBeGreaterThan(0);
        for (const element of found) {
          expect(element.classList.contains(cls), `«${name}» debe llevar ${cls}`).toBe(true);
          expect(element.classList.contains('block'), `«${name}» debe seguir siendo un bloque`).toBe(true);
        }
      });
    }

    it(`RF-17 (003) · 17.3: ${row.screen} conserva las acciones de la tabla`, async () => {
      const main = await mount(row);
      for (const [name] of row.actions) expect(actionsNamed(main, name).length, `falta «${name}»`).toBeGreaterThan(0);
    });
  }
});
