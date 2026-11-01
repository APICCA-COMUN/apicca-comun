import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import { useRoute } from '../app/router';
import type { LogEntry, SectionsSource } from '../data/constitution/sections';
import { SuspendedNotice } from '../components/SuspendedNotice';
import { expectOnePrimary } from '../testing/expectActions';
import { ConstitutionHistory } from './ConstitutionHistory';
import { LoginPage } from './Login';

const member: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const AT = Date.UTC(2026, 5, 15, 17);

const log: LogEntry[] = [
  { seq: 3, kind: 'removed', sectionId: 'b', sectionTitle: 'Cuidado', version: 2, amendmentId: 'p2', byUid: 'u2', byUsername: 'beto', at: AT + 3000 },
  { seq: 2, kind: 'changed', sectionId: 'a', sectionTitle: 'Agua', version: 2, amendmentId: 'p1', byUid: 'u1', byUsername: 'ana', at: AT + 2000 },
  { seq: 1, kind: 'opened', sectionId: null, sectionTitle: null, version: null, amendmentId: null, byUid: 'f1', byUsername: 'fabi', at: AT },
];

function source(entries: LogEntry[] = log): SectionsSource & { audiences: string[] } {
  const audiences: string[] = [];
  return {
    audiences,
    onState: () => () => undefined,
    onSections: () => () => undefined,
    onMeta: () => () => undefined,
    onVersions: () => () => undefined,
    onLog: (audience, cb) => {
      audiences.push(audience);
      cb(entries);
      return () => undefined;
    },
  };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

function setup(session: SessionState, src: SectionsSource = source()) {
  window.history.replaceState(null, '', '/constitucion/historial');
  return render(
    <SessionProvider initial={session}>
      <SuspendedNotice />
      <ConstitutionHistory source={src} />
    </SessionProvider>,
  );
}

describe('ConstitutionHistory · tabla del conjunto', () => {
  it('RF-3 (004) · 3.1: muestra sección, tipo de cambio, quién y fecha de cada entrada', () => {
    setup(member);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);
    expect(cells(rows[0]!)).toEqual(['Cuidado', 'Retirada', 'beto', '2026-06-15']);
    expect(cells(rows[1]!)).toEqual(['Agua', 'Cambiada', 'ana', '2026-06-15']);
    expect(cells(rows[2]!)[1]).toBe('Apertura');
    expect(cells(rows[2]!)[2]).toBe('fabi');
  });

  it('RF-3 (004) · 3.1: nombra los tipos «añadida» y «apertura» y enlaza cada sección a su historial', () => {
    setup(member, source([{ ...log[1]!, kind: 'added' }, log[2]!]));
    expect(screen.getByText('Añadida')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Agua' }).getAttribute('href')).toBe('/constitucion/secciones/a');
  });

  it('RF-3 (004) · 3.5: nombra a cada persona con el nombre de usuario guardado en el hecho', () => {
    setup(member, source([{ ...log[1]!, byUsername: 'ana-antes' }]));
    expect(screen.getByText('ana-antes')).toBeTruthy();
  });

  it('RF-3 (004) · 3.1: con el registro vacío lo dice', () => {
    setup(member, source([]));
    expect(screen.getByText(/todavía no hay cambios/i)).toBeTruthy();
  });

  it('RF-3 (004) · 3.1: la página no tiene acción azul', () => {
    const { container } = setup(member);
    expectOnePrimary(container, null);
  });
});

describe('ConstitutionHistory · accesos', () => {
  it('RF-3 (004) · 3.4: sin sesión guarda la ruta, lleva a /entrar y no lee el registro', () => {
    const src = source();
    setup({ status: 'visitor' }, src);
    expect(window.location.pathname).toBe('/entrar');
    expect(window.sessionStorage.getItem('apicca:returnTo')).toBe('/constitucion/historial');
    expect(src.audiences).toEqual([]);
  });

  it('RF-3 (004) · 3.4: tras entrar vuelve a /constitucion/historial', () => {
    setup({ status: 'visitor' });
    document.body.innerHTML = '';
    const Probe = () => <p>{useRoute().path}</p>;
    render(
      <SessionProvider initial={member}>
        <LoginPage />
        <Probe />
      </SessionProvider>,
    );
    expect(window.location.pathname).toBe('/constitucion/historial');
  });

  it('RF-3 (004) · 3.6: con la cuenta suspendida muestra el aviso de suspensión y no el historial', () => {
    const src = source();
    setup({ status: 'suspended', uid: 'u1' }, src);
    expect(screen.getByRole('alert').textContent).toMatch(/suspend/i);
    expect(screen.queryByRole('table')).toBeNull();
    expect(src.audiences).toEqual([]);
  });

  it('RF-3 (004) · 3.4: mientras la sesión carga no redirige', () => {
    setup({ status: 'loading' });
    expect(window.location.pathname).toBe('/constitucion/historial');
  });
});
