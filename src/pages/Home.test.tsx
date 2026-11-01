import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { SessionProvider, type SessionState } from '../app/session';
import { AXIS_LABEL } from '../components/AxisIcon';
import { expectOnePrimary } from '../testing/expectActions';
import { Home } from './Home';

// Textos de relleno propios de la prueba: las aserciones miran la estructura, no el texto real (D-21 (003)).
vi.mock('./homeContent', () => ({
  HOME_CONTENT: {
    axes: {
      agua: 'Frase de prueba del agua',
      alimento: 'Frase de prueba del alimento',
      cobijo: 'Frase de prueba del cobijo',
      energía: 'Frase de prueba de la energía',
      comunicación: 'Frase de prueba de la comunicación',
    },
    steps: [
      { title: 'Título uno', text: 'Paso de prueba uno' },
      { title: 'Título dos', text: 'Paso de prueba dos' },
      { title: 'Título tres', text: 'Paso de prueba tres' },
    ],
  },
}));

// El inicio no consulta ápices (RNF-5 (003)): la fuente de datos se espía y no debe llamarse.
const fetchPage = vi.hoisted(() => vi.fn());
vi.mock('../data/apices', () => ({ firestoreListSource: { fetchPage } }));

// Los caminos y los nodos tienen sus propias pruebas (RF-9 (003)); aquí solo se cuenta dónde se usan.
vi.mock('../components/RoadSegment', () => ({ RoadSegment: () => <svg data-testid="road" aria-hidden="true" /> }));
vi.mock('../components/Node', () => ({ Node: () => <span data-testid="node" aria-hidden="true" /> }));

const person: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };

beforeEach(() => {
  fetchPage.mockClear();
  window.history.replaceState(null, '', '/');
});

function setup(session: SessionState) {
  return render(
    <SessionProvider initial={session}>
      <Home />
    </SessionProvider>,
  );
}

describe('Home · estructura (RF-10 (003))', () => {
  it('RF-6 (008) · 6.6, D-10 (008): abre con el h1 del lienzo y su entrada', () => {
    setup({ status: 'visitor' });
    expect(screen.getByRole('heading', { level: 1, name: 'Encuéntrate y co-crea con otras personas' })).toBeTruthy();
    expect(
      screen.getByText('Un marco de apoyo mutuo para crear juntas agua, alimento, cobijo, energía y comunicación.'),
    ).toBeTruthy();
  });

  it('RF-6 (008) · 6.7, D-10 (008): el mapa es una imagen con nombre accesible y seis ápices', () => {
    const { container } = setup({ status: 'visitor' });
    const map = screen.getByRole('img', { name: 'Mapa de ejemplo: seis ápices conectados por caminos y hebras' });
    expect(map.classList.contains('map-illustration')).toBe(true);
    expect(container.querySelectorAll('.map-illustration__building')).toHaveLength(6);
  });

  it('RF-6 (008) · 6.8, D-10 (008): las secciones van en el orden del lienzo, con sus títulos', () => {
    const { container } = setup({ status: 'visitor' });
    const titles = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(titles).toEqual([
      'Un ápice conecta cinco ejes de autonomía compartida.',
      'Cómo funciona',
      'Nada se compra ni se vende: se hace juntas.',
    ]);
  });

  it('RF-6 (008) · 6.6, D-10 (008): «Ver los ápices» es un enlace de texto a Prototipado', () => {
    setup({ status: 'visitor' });
    const link = screen.getByRole('link', { name: 'Ver los ápices' });
    expect(link.getAttribute('href')).toBe('/prototipado');
    expect(link.className).toBe('');
  });

  it('RF-6 (008) · 6.8, D-10 (008): el cierre lleva «Leer los 7 principios» hacia la Constitución', () => {
    setup({ status: 'visitor' });
    expect(screen.getByRole('link', { name: 'Leer los 7 principios' }).getAttribute('href')).toBe('/constitucion');
  });

  it('RF-6 (008) · 6.6, RF-4 (003) · 4.2: sin sesión, «Pide tu inscripción» es la única acción azul', () => {
    setup({ status: 'visitor' });
    expectOnePrimary(document.body, 'Pide tu inscripción');
    expect(screen.getByRole('link', { name: 'Pide tu inscripción' }).getAttribute('href')).toBe('/solicitar');
    expect(screen.queryByRole('link', { name: 'Nuevo ápice' })).toBeNull();
  });

  it('RF-10 (003) · 10.2, RF-4 (003) · 4.2: con sesión, «Nuevo ápice» es la única acción azul', () => {
    setup(person);
    expectOnePrimary(document.body, 'Nuevo ápice');
    expect(screen.getByRole('link', { name: 'Nuevo ápice' }).getAttribute('href')).toBe('/apices/nuevo');
    expect(screen.queryByRole('link', { name: 'Pide tu inscripción' })).toBeNull();
  });

  it('RF-6 (008) · 6.9, D-10 (008): los cinco ejes llevan ícono, nombre en h3 y frase', () => {
    const { container } = setup({ status: 'visitor' });
    const items = [...container.querySelectorAll<HTMLElement>('[data-axis]:not(.map-illustration__building)')];
    expect(items.map((item) => item.getAttribute('data-axis'))).toEqual([...AXES]);
    for (const item of items) {
      const axis = item.getAttribute('data-axis') as (typeof AXES)[number];
      expect(item.querySelector('svg.axis-icon')).not.toBeNull();
      expect(within(item).getByRole('heading', { level: 3, name: AXIS_LABEL[axis] })).toBeTruthy();
      expect(within(item).getByText(new RegExp(`^Frase de prueba de.*${axis.slice(0, 3)}`))).toBeTruthy();
    }
  });

  it('RF-6 (008) · 6.9, RF-9 (003) · 9.4: los tres pasos van en un ol, con título h3, texto y un nodo cada uno', () => {
    const { container } = setup({ status: 'visitor' });
    const list = container.querySelector('ol') as HTMLElement;
    const steps = [...list.querySelectorAll(':scope > li')];
    expect(steps).toHaveLength(3);
    steps.forEach((step, index) => {
      expect(step.querySelector('h3')?.textContent).toBe(['Título uno', 'Título dos', 'Título tres'][index]);
      expect(step.textContent).toContain(['Paso de prueba uno', 'Paso de prueba dos', 'Paso de prueba tres'][index]);
      expect(step.querySelector('[data-testid="node"]')).not.toBeNull();
    });
    expect(list.querySelector('[data-testid="road"]')).not.toBeNull();
  });

  it('RF-9 (003) · 9.4: quitar caminos y nodos no cambia el texto del inicio', () => {
    const { container } = setup({ status: 'visitor' });
    const before = container.textContent;
    container.querySelectorAll('[data-testid="road"], [data-testid="node"]').forEach((el) => el.remove());
    expect(container.textContent).toBe(before);
  });

  it('RF-10 (003) · 10.6: cierra con un enlace a la Constitución, después de los pasos', () => {
    const { container } = setup({ status: 'visitor' });
    const link = container.querySelector('a[href="/constitucion"]') as HTMLElement;
    expect(link).not.toBeNull();
    const list = container.querySelector('ol') as HTMLElement;
    expect(list.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Home · sin ápices (RF-10 (003) · 10.8, RNF-5 (003), D-T11 (003))', () => {
  it('RF-10 (003) · 10.8: el inicio no pinta tarjetas de ápices ni filtros', () => {
    setup(person);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Estado' })).toBeNull();
  });

  it('RNF-5 (003): el inicio no consulta la colección de ápices', async () => {
    setup(person);
    await Promise.resolve();
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
