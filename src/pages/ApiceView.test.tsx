import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource } from '../data/apices';
import { fakeClient } from '../testing/facilitationDoubles';
import { expectBlocks } from '../testing/expectBlocks';
import { ApiceView } from './ApiceView';

const apice = (extra: Partial<ApiceDoc> = {}): ApiceDoc => ({
  id: 'a1',
  version: 2,
  name: 'Cosecha de lluvia',
  description: 'Captamos agua de lluvia.',
  axes: ['agua', 'cobijo'],
  needs: 'Canaletas y tanques',
  offers: 'Mano de obra',
  status: 'prototipo',
  visibility: 'public',
  isArchived: false,
  authorUid: 'u-ana',
  authorUsername: 'ana',
  lastEditedByUsername: 'beto',
  updatedAt: { seconds: Date.parse('2026-09-03T15:00:00Z') / 1000, nanoseconds: 0 },
  ...extra,
});

function fakeSource(initial: ApiceDoc | null) {
  let listener: ((a: ApiceDoc | null) => void) | null = null;
  const source: ApiceSource = {
    onApice(_id, callback) {
      listener = callback;
      callback(initial);
      return () => {
        listener = null;
      };
    },
  };
  return { source, push: (a: ApiceDoc | null) => act(() => listener?.(a)) };
}

const ana: SessionState = { status: 'person', uid: 'u-ana', role: 'member', username: 'ana' };
const otra: SessionState = { status: 'person', uid: 'u-otra', role: 'member', username: 'otra' };
const fabi: SessionState = { status: 'person', uid: 'fab', role: 'facilitator', username: 'fabi' };

function setup(doc: ApiceDoc | null, session: SessionState, handlers = {}) {
  const src = fakeSource(doc);
  const cl = fakeClient({ setVisibility: () => ({}), archiveApice: () => ({}), restoreApice: () => ({}), ...handlers });
  render(
    <SessionProvider initial={session}>
      <ApiceView id="a1" source={src.source} client={cl.client} />
    </SessionProvider>,
  );
  return { ...src, calls: cl.calls };
}

describe('ApiceView', () => {
  it('RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2: el contenido del ápice va en un lote con su superficie arriba y el nombre debajo', () => {
    const { container } = render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <ApiceView id="a1" source={fakeSource(apice()).source} client={fakeClient({}).client} />
      </SessionProvider>,
    );
    const lot = container.querySelector('.lot')!;
    expect(lot).not.toBeNull();
    expect(lot.matches('article')).toBe(true);
    expect(container.querySelectorAll('article.lot').length).toBe(1);
    // La ficha ya no es un bloque: solo lo son sus paneles internos.
    expect(lot.classList.contains('block')).toBe(false);
    const heading = lot.querySelector('h1')!; // RF-18 (019) · 18.1, D-T12 (019)
    const surface = lot.querySelector('.superficie')!;
    expect(heading.textContent).toBe('Cosecha de lluvia');
    expect(surface).not.toBeNull();
    // La superficie va primero, a todo el ancho de la ficha, sin contorno propio: el borde de 3 px ya lo cumple.
    expect(surface.parentElement).toBe(lot);
    expect(surface.classList.contains('superficie--contorno')).toBe(false);
    expect(surface.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.parentElement).not.toBe(lot);
    expectBlocks(container, { nesting: true });
  });

  it('RF-22 (001): la ficha muestra todos los datos', () => {
    setup(apice(), { status: 'visitor' });
    expect(screen.getByRole('heading', { name: 'Cosecha de lluvia' })).toBeTruthy();
    expect(screen.getByText('Captamos agua de lluvia.')).toBeTruthy();
    expect(screen.getByText('Canaletas y tanques')).toBeTruthy();
    expect(screen.getByText('Mano de obra')).toBeTruthy();
    expect(screen.getByText('agua y cobijo · prototipo')).toBeTruthy(); // RF-17 (019) · 17.2: el rótulo dice la Etapa
    expect(screen.getByText(/Creado por ana/)).toBeTruthy();
    expect(screen.getByText(/beto/)).toBeTruthy();
    expect(screen.getByText(/3 de septiembre de 2026/)).toBeTruthy(); // RF-11 (019) · 11.4
  });

  it('RF-22 (001): lo que falta (ubicación, necesidades) se muestra como marcador vacío', () => {
    setup(apice({ needs: '', location: null }), { status: 'visitor' });
    expect(screen.getByText('Sin ubicación')).toBeTruthy();
    expect(screen.getByText('Sin declarar.')).toBeTruthy();
  });

  it('RF-22 (001): la ficha de una autora suspendida se ve igual', () => {
    setup(apice(), { status: 'visitor' });
    expect(screen.getByText(/Creado por ana/)).toBeTruthy();
    expect(screen.queryByText(/suspendid/i)).toBeNull();
  });

  it('RF-22 (001): un ápice inexistente muestra «No se encontró el ápice»', () => {
    setup(null, ana);
    expect(screen.getByText('No se encontró el ápice.')).toBeTruthy();
  });

  it('RF-22 (001): un ápice privado, para quien no tiene sesión, se ve igual que uno inexistente', () => {
    const a = setup(apice({ visibility: 'private' }), { status: 'visitor' });
    const texto = document.body.textContent;
    expect(texto).toContain('No se encontró el ápice.');
    expect(texto).not.toContain('Cosecha de lluvia');
    expect(a.calls).toEqual([]);
  });

  it('RF-22 (001), RF-14 (001): un ápice archivado sin permiso se ve igual que uno inexistente, y para un visitante también', () => {
    setup(apice({ isArchived: true }), { status: 'visitor' });
    expect(document.body.textContent).toContain('No se encontró el ápice.');
  });

  it('RF-22 (001): si el ápice se vuelve privado mientras se mira, la ficha desaparece', () => {
    const { push } = setup(apice(), { status: 'visitor' });
    expect(screen.getByRole('heading', { name: 'Cosecha de lluvia' })).toBeTruthy();
    push(null);
    expect(screen.getByText('No se encontró el ápice.')).toBeTruthy();
  });

  it('RF-14 (021) · 14.3: una cuenta activa ve «Editar» y lleva al formulario; un visitante y un ápice archivado, no', () => {
    setup(apice(), otra);
    expect(screen.getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe('/apices/a1/editar');
    cleanup();
    setup(apice(), { status: 'visitor' });
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    cleanup();
    setup(apice({ isArchived: true }), ana);
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
  });

  it('RF-13 (001): solo la autora y la facilitadora ven el control de visibilidad', () => {
    setup(apice(), ana);
    expect(screen.getByRole('button', { name: 'Hacer privado' })).toBeTruthy();
  });

  it('RF-13 (001): una cuenta ajena no ve ni visibilidad ni archivo', () => {
    setup(apice(), otra);
    expect(screen.queryByRole('button', { name: 'Hacer privado' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull();
  });

  it('RF-13 (001): la facilitadora cambia la visibilidad de un ápice ajeno', async () => {
    const { calls } = setup(apice(), fabi);
    await userEvent.click(screen.getByRole('button', { name: 'Hacer privado' }));
    expect(calls).toEqual([{ op: 'setVisibility', payload: { id: 'a1', visibility: 'private' } }]);
  });

  it('RF-14 (001): la autora archiva desde la ficha', async () => {
    const { calls } = setup(apice(), ana);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(calls).toEqual([{ op: 'archiveApice', payload: { id: 'a1' } }]);
  });

  it('RF-14 (001): la autora ve su ápice archivado con aviso, solo con restaurar y sin cambiar visibilidad', async () => {
    const { calls } = setup(apice({ isArchived: true }), ana);
    expect(screen.getByText(/archivado/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hacer privado' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(calls).toEqual([{ op: 'restoreApice', payload: { id: 'a1' } }]);
  });

  it('RF-14 (001): la facilitadora ve un ápice archivado ajeno, aunque sea privado', () => {
    setup(apice({ isArchived: true, visibility: 'private' }), fabi);
    expect(screen.getByRole('heading', { name: 'Cosecha de lluvia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restaurar' })).toBeTruthy();
  });
});

describe('ApiceView · ubicación', () => {
  it('RF-22 (001): una ubicación aproximada se muestra como zona de ≈ 5 km²', () => {
    setup(apice({ location: { lat: -33.455, lng: -70.665, precision: 'approximate' } }), { status: 'visitor' });
    expect(screen.getByText('Zona de ≈ 5 km² alrededor de -33.455, -70.665')).toBeTruthy();
  });

  it('RF-9 (001): una ubicación exacta se muestra como punto', () => {
    setup(apice({ location: { lat: -33.4512, lng: -70.6634, precision: 'exact' } }), { status: 'visitor' });
    expect(screen.getByText('Punto exacto: -33.4512, -70.6634')).toBeTruthy();
  });

  it('RF-9 (001): la ficha no pide el punto exacto a nadie, ni a la autora', () => {
    let asked = false;
    const { source } = fakeSource(apice({ location: { lat: 1.005, lng: 2.005, precision: 'approximate' } }));
    const spy: ApiceSource = { ...source, readExact: async () => ((asked = true), null) };
    render(
      <SessionProvider initial={ana}>
        <ApiceView id="a1" source={spy} client={fakeClient({}).client} />
      </SessionProvider>,
    );
    expect(asked).toBe(false);
  });
});

describe('ApiceView · sin imagen (021)', () => {
  // Un documento de antes de la 021 trae su imagen aceptada; el almacén la conserva y la ficha no la muestra (RF-27 (021) · 27.4).
  const withImage = { ...apice(), image: { altText: 'Una huerta pixelada', png: new Uint8Array([137, 80, 78, 71]) } } as ApiceDoc;

  for (const [who, session] of [
    ['una visitante', { status: 'visitor' }],
    ['la autora', ana],
    ['otra persona inscrita', otra],
    ['la facilitación', fabi],
  ] as const) {
    it(`RF-1 (021) · 1.1, RF-27 (021) · 27.1: para ${who}, la ficha no ofrece generar, ni propuestas, ni referencias, ni muestra imágenes`, () => {
      const { calls } = setup(withImage, session);
      expect(screen.getByRole('heading', { name: 'Cosecha de lluvia' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Generar imagen' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Subir referencia' })).toBeNull();
      expect(screen.queryByRole('region', { name: /Referencias/i })).toBeNull();
      expect(document.body.textContent).not.toMatch(/generaci|referencia|propuesta|Sin imagen/i);
      expect(document.querySelectorAll('img, .pixel-image, input[type="file"]')).toHaveLength(0);
      expect(screen.queryByRole('img', { name: 'Una huerta pixelada' })).toBeNull();
      // Ni siquiera pregunta por el cupo de generación.
      expect(calls).toEqual([]);
    });
  }
});

describe('ApiceView · bloques (002)', () => {
  // Los controles de la ficha son de VisibilityControl y ArchiveControls;
  // la página pone la ficha misma, que es una tarjeta, y el enlace «Historial», que es un enlace normal.
  it('RF-6 (002) · 6.1, 6.3: la ficha es un lote (antes un bloque; RF-3 (003) · 3.2, D-T21 (003)) y el enlace «Historial» no lleva clase de acción', () => {
    setup(apice(), ana);
    expect(screen.getByRole('article', { name: '' }).classList.contains('lot')).toBe(true);
    expect(screen.getByRole('link', { name: 'Historial' }).className).toBe('');
  });
});

describe('ApiceView · identidad (002)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RF-4 (002) · 4.2: los ejes los dicen la superficie (con su glifo), el rótulo y el nombre accesible; no hay insignias aparte', () => {
    setup(apice({ axes: ['agua', 'cobijo'] }), { status: 'visitor' });
    const container = document.body;
    expect(screen.getByText('agua y cobijo · prototipo')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'agua y cobijo, Etapa Prototipo' })).toBeTruthy();
    expect(container.querySelector('.axis-badge')).toBeNull();
    expect(container.querySelector('[aria-label="Ejes"]')).toBeNull();
  });

  it('la superficie de la ficha lleva una franja por eje y la regla de su Etapa', () => {
    const { container } = render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <ApiceView id="a1" source={fakeSource(apice()).source} client={fakeClient({}).client} />
      </SessionProvider>,
    );
    const surface = container.querySelector('.superficie')!;
    expect(surface.getAttribute('data-rule')).toBe('encaje');
    expect(surface.getAttribute('aria-label')).toBe('agua y cobijo, Etapa Prototipo');
    expect(surface.querySelectorAll('svg.superficie__franja')).toHaveLength(2);
  });

  it('el rótulo agrega el código de la zona cuando el Ápice tiene una', () => {
    const location = { lat: 4.6, lng: -74.1, precision: 'approximate' as const, zone: { cell: '872830828ffffff', lat: 4.6, lng: -74.1 } };
    setup(apice({ location }), { status: 'visitor' });
    expect(screen.getByText('agua y cobijo · prototipo · zona 0828')).toBeTruthy();
  });

  it('RF-13 (002) · 13.1, 13.3: el estado, la visibilidad y el archivo son etiquetas con los textos de la 001', () => {
    const show = (doc: ApiceDoc) =>
      render(
        <SessionProvider initial={ana}>
          <ApiceView id="a1" source={fakeSource(doc).source} client={fakeClient({}).client} />
        </SessionProvider>,
      ).container;
    const tag = (container: HTMLElement, condition: string) => container.querySelector(`.tag[data-condition="${condition}"]`)?.textContent;
    const active = show(apice());
    expect(screen.getByText('agua y cobijo · prototipo')).toBeTruthy(); // RF-17 (019) · 17.2: la etapa la dice el rótulo
    expect(tag(active, 'visibility')).toBe('público');
    cleanup();
    expect(tag(show(apice({ isArchived: true })), 'archived')).toBe('archivado');
  });
});

describe('ApiceView · taller (019)', () => {
  const show = (doc: ApiceDoc) =>
    render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <ApiceView id="a1" source={fakeSource(doc).source} client={fakeClient({}).client} />
      </SessionProvider>,
    ).container;

  it('RF-11 (019) · 11.2, D-T23 (019): «Ofrece:» y «Necesita:» son una línea cada uno en el cuerpo de la ficha, con su ícono y sin lotes anidados, antes de Ubicación', () => {
    const container = show(apice());
    const body = container.querySelector('.apice-view__body')!;
    const rows = body.querySelectorAll('.apice-view__datos > p.apice-view__dato');
    expect(rows.length).toBe(2);
    expect(rows[0]!.querySelector('strong')!.textContent).toBe('Ofrece:');
    expect(rows[1]!.querySelector('strong')!.textContent).toBe('Necesita:');
    expect(rows[0]!.querySelector('svg.icono--ofrece')).not.toBeNull();
    expect(rows[1]!.querySelector('svg.icono--necesita')).not.toBeNull();
    expect(rows[0]!.nextElementSibling).toBe(rows[1]);
    expect(body.querySelector('section.lot')).toBeNull();
    const datos = container.querySelector('.apice-view__datos')!;
    expect(datos.compareDocumentPosition(screen.getByRole('heading', { name: 'Ubicación' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Ofrece|Necesita/ })).toBeNull();
  });

  it('RF-11 (019) · 11.4: la fecha de la última edición es larga, en hora de Bogotá', () => {
    show(apice({ updatedAt: { seconds: Date.parse('2026-11-03T04:00:00Z') / 1000, nanoseconds: 0 } }));
    expect(screen.getByText(/Última edición el 2 de noviembre de 2026/)).toBeTruthy();
  });
});
