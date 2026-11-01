import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Section, SectionVersion } from '../../shared/domain/constitution';
import { SessionProvider, type SessionState } from '../app/session';
import { SuspendedNotice } from '../components/SuspendedNotice';
import type { SectionsSource } from '../data/constitution/sections';
import { expectOnePrimary } from '../testing/expectActions';
import { ConstitutionSection } from './ConstitutionSection';

const member: SessionState = { status: 'person', uid: 'u1', role: 'member', username: 'ana' };
const AT = Date.UTC(2026, 5, 15, 17);

const retired: Section = { id: 'b', title: 'Cuidado', text: 'Texto', updatedAt: AT, isRetired: true, retiredAt: AT };
const versions: SectionVersion[] = [
  {
    version: 2, title: 'Cuidado', text: 'Texto', kind: 'change', amendmentId: 'p1', proposedByUid: 'u1', proposedByUsername: 'ana',
    agreementsCounted: 3, authorAgreementCounted: true, objectionsResolved: 1, objectionsWithdrawn: 0, at: AT + 1000,
  },
  {
    version: 1, title: 'Cuidado', text: 'Inicial', kind: 'initial', amendmentId: null, proposedByUid: null, proposedByUsername: 'texto inicial',
    agreementsCounted: 0, authorAgreementCounted: false, objectionsResolved: 0, objectionsWithdrawn: 0, at: AT,
  },
];

function source(sections: Section[] = [retired], vs: SectionVersion[] = versions) {
  const calls: string[] = [];
  const src: SectionsSource = {
    onState: () => () => undefined,
    onSections: (audience, cb) => {
      calls.push(`sections:${audience}`);
      cb(sections);
      return () => undefined;
    },
    onMeta: () => () => undefined,
    onVersions: (audience, id, cb) => {
      calls.push(`versions:${audience}:${id}`);
      cb(vs);
      return () => undefined;
    },
    onLog: () => () => undefined,
  };
  return { src, calls };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

function setup(session: SessionState, src: SectionsSource, id = 'b') {
  window.history.replaceState(null, '', `/constitucion/secciones/${id}`);
  return render(
    <SessionProvider initial={session}>
      <SuspendedNotice />
      <ConstitutionSection id={id} source={src} />
    </SessionProvider>,
  );
}

describe('ConstitutionSection · historial de una sección', () => {
  it('RF-3 (004) · 3.2: de una sección retirada muestra el título, que está retirada y sus versiones con acuerdos y objeciones', () => {
    setup(member, source().src);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Cuidado');
    expect(screen.getByText('Sección retirada')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Historial de versiones' })).toBeTruthy();
    expect(screen.getByText('Versión 2')).toBeTruthy();
    expect(screen.getByText(/3 acuerdos/)).toBeTruthy();
    expect(screen.getByText(/1 resuelta/)).toBeTruthy();
    expect(screen.getByText(/texto inicial/)).toBeTruthy();
  });

  it('RF-3 (004) · 3.2: lee como cuenta activa y enlaza de vuelta al historial del conjunto', () => {
    const { src, calls } = source();
    setup(member, src);
    expect(calls).toContain('versions:member:b');
    expect(screen.getByRole('link', { name: /historial de la constitución/i }).getAttribute('href')).toBe('/constitucion/historial');
  });

  it('RF-3 (004) · 3.2: si la sección no existe lo dice', () => {
    setup(member, source([], []).src, 'zzz');
    expect(screen.getByText(/no existe/i)).toBeTruthy();
  });

  it('RNF-4 (004): los encabezados bajan de a un nivel (h1, h2 «Versiones», h3 por versión)', () => {
    const { container } = setup(member, source().src);
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]));
    levels.forEach((level, i) => expect(level - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Versiones');
  });

  it('RF-3 (004) · 3.2: la página no tiene acción azul', () => {
    const { container } = setup(member, source().src);
    expectOnePrimary(container, null);
  });
});

describe('ConstitutionSection · accesos', () => {
  it('RF-3 (004) · 3.4: sin sesión guarda la ruta, lleva a /entrar y no lee nada', () => {
    const { src, calls } = source();
    setup({ status: 'visitor' }, src);
    expect(window.location.pathname).toBe('/entrar');
    expect(window.sessionStorage.getItem('apicca:returnTo')).toBe('/constitucion/secciones/b');
    expect(calls).toEqual([]);
  });

  it('RF-3 (004) · 3.6: con la cuenta suspendida muestra el aviso y no el historial', () => {
    const { src, calls } = source();
    setup({ status: 'suspended', uid: 'u1' }, src);
    expect(screen.getByRole('alert').textContent).toMatch(/suspend/i);
    expect(screen.queryByRole('list', { name: 'Historial de versiones' })).toBeNull();
    expect(calls).toEqual([]);
  });
});
