import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, type SessionState } from '../app/session';
import type { ApiceDoc, ApiceSource } from '../data/apices';
import { fakeClient } from '../testing/facilitationDoubles';
import type { ProposalSource } from '../data/proposals';
import type { ReferenceSource } from '../data/references';
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
  image: null,
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

/** La consulta de generaciones del panel no es lo que miran las pruebas de ops de la ficha. */
const withoutStatus = (calls: Array<{ op: string }>) => calls.filter((c) => c.op !== 'generationStatus');

function setup(doc: ApiceDoc | null, session: SessionState, handlers = {}) {
  const src = fakeSource(doc);
  const cl = fakeClient({ generationStatus: () => ({ remaining: 3, limit: 3, resetAt: '2026-10-08T05:00:00.000Z', blockedUntil: null }), setVisibility: () => ({}), archiveApice: () => ({}), restoreApice: () => ({}), ...handlers });
  render(
    <SessionProvider initial={session}>
      <ApiceView id="a1" source={src.source} client={cl.client} />
    </SessionProvider>,
  );
  return { ...src, calls: cl.calls };
}

describe('ApiceView', () => {
  it('RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2: el contenido del ápice va en un lote con su edificio junto al nombre', () => {
    const { container } = render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <ApiceView id="a1" source={fakeSource(apice()).source} client={fakeClient({}).client} />
      </SessionProvider>,
    );
    const lot = container.querySelector('.lot')!;
    expect(lot).not.toBeNull();
    expect(lot.matches('article')).toBe(true);
    expect(container.querySelectorAll('.lot').length).toBe(1);
    // La ficha ya no es un bloque: solo lo son sus paneles internos y el edificio.
    expect(lot.classList.contains('block')).toBe(false);
    const heading = lot.querySelector('h2')!;
    const building = lot.querySelector('.block.building')!;
    expect(heading.textContent).toBe('Cosecha de lluvia');
    expect(building).not.toBeNull();
    expect(building.parentElement).toBe(heading.parentElement);
    expect(heading.parentElement).not.toBe(lot);
    expectBlocks(container, { nesting: true });
  });

  it('RF-22 (001): la ficha muestra todos los datos', () => {
    setup(apice(), { status: 'visitor' });
    expect(screen.getByRole('heading', { name: 'Cosecha de lluvia' })).toBeTruthy();
    expect(screen.getByText('Captamos agua de lluvia.')).toBeTruthy();
    expect(screen.getByText('Agua')).toBeTruthy();
    expect(screen.getByText('Cobijo')).toBeTruthy();
    expect(screen.getByText('Canaletas y tanques')).toBeTruthy();
    expect(screen.getByText('Mano de obra')).toBeTruthy();
    expect(screen.getByText('prototipo')).toBeTruthy();
    expect(screen.getByText(/Creado por ana/)).toBeTruthy();
    expect(screen.getByText(/beto/)).toBeTruthy();
    expect(screen.getByText(/\b3\b.*2026/)).toBeTruthy();
  });

  it('RF-22 (001): lo que falta (ubicación, imagen, necesidades) se muestra como marcador vacío', () => {
    setup(apice({ needs: '', location: null }), { status: 'visitor' });
    expect(screen.getByRole('img', { name: 'Sin imagen' })).toBeTruthy();
    expect(screen.getByText('Sin ubicación')).toBeTruthy();
    expect(screen.getByText('Aún no se han escrito necesidades.')).toBeTruthy();
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
    expect(withoutStatus(a.calls)).toEqual([]);
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
    expect(withoutStatus(calls)).toEqual([{ op: 'setVisibility', payload: { id: 'a1', visibility: 'private' } }]);
  });

  it('RF-14 (001): la autora archiva desde la ficha', async () => {
    const { calls } = setup(apice(), ana);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(withoutStatus(calls)).toEqual([{ op: 'archiveApice', payload: { id: 'a1' } }]);
  });

  it('RF-14 (001): la autora ve su ápice archivado con aviso, solo con restaurar y sin cambiar visibilidad', async () => {
    const { calls } = setup(apice({ isArchived: true }), ana);
    expect(screen.getByText(/archivado/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hacer privado' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(withoutStatus(calls)).toEqual([{ op: 'restoreApice', payload: { id: 'a1' } }]);
  });

  it('RF-14 (001): la facilitadora ve un ápice archivado ajeno, aunque sea privado', () => {
    setup(apice({ isArchived: true, visibility: 'private' }), fabi);
    expect(screen.getByRole('heading', { name: 'Cosecha de lluvia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restaurar' })).toBeTruthy();
  });
});

describe('ApiceView · ubicación', () => {
  it('RF-22 (001): una ubicación aproximada se muestra como zona de ≈ 1 km', () => {
    setup(apice({ location: { lat: -33.455, lng: -70.665, precision: 'approximate' } }), { status: 'visitor' });
    expect(screen.getByText('Zona de ≈ 1 km alrededor de -33.455, -70.665')).toBeTruthy();
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

describe('ApiceView · referencias', () => {
  const refs: ReferenceSource = { onReferences: (_id, _o, cb) => (cb([]), () => undefined), readImage: async () => 'blob:x' };
  const view = (doc: ApiceDoc, session: SessionState) =>
    render(
      <SessionProvider initial={session}>
        <ApiceView id="a1" source={fakeSource(doc).source} client={fakeClient({}).client} referenceSource={refs} />
      </SessionProvider>,
    );

  it('RF-15 (001): una persona inscrita ve el formulario de subida en un ápice no archivado', () => {
    view(apice(), otra);
    expect(screen.getByRole('button', { name: 'Subir referencia' })).toBeTruthy();
  });

  it('RF-15 (001): una visitante ve las referencias pero no puede subir', () => {
    view(apice(), { status: 'visitor' });
    expect(screen.getByRole('region', { name: 'Referencias' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Subir referencia' })).toBeNull();
  });

  it('RF-16 (001): en un ápice archivado no se sube, y la facilitación sí ve las quitadas', () => {
    view(apice({ isArchived: true }), fabi);
    expect(screen.queryByRole('button', { name: 'Subir referencia' })).toBeNull();
    expect(screen.getByRole('region', { name: /quitadas o retiradas/i })).toBeTruthy();
  });
});

describe('ApiceView · imagen pixelada', () => {
  const proposals: ProposalSource = { onProposal: (_a, _u, cb) => (cb(null), () => undefined) };
  const refs: ReferenceSource = { onReferences: (_id, _o, cb) => (cb([]), () => undefined), readImage: async () => 'blob:x' };
  const view = (doc: ApiceDoc, session: SessionState) =>
    render(
      <SessionProvider initial={session}>
        <ApiceView
          id="a1"
          source={fakeSource(doc).source}
          client={fakeClient({ generationStatus: () => ({ remaining: 3, limit: 3, resetAt: '2026-10-08T05:00:00.000Z', blockedUntil: null }) }).client}
          referenceSource={refs}
          proposalSource={proposals}
        />
      </SessionProvider>,
    );

  it('RF-17 (001): una persona inscrita ve cuántas generaciones le quedan y puede generar', async () => {
    view(apice(), otra);
    expect(await screen.findByText(/Te quedan 3 de 3 generaciones hoy/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generar imagen' })).toBeTruthy();
  });

  it('RF-17 (001): una visitante o un ápice archivado no ofrecen generar', () => {
    view(apice(), { status: 'visitor' });
    expect(screen.queryByRole('button', { name: 'Generar imagen' })).toBeNull();
  });

  it('RF-18 (001): la imagen aceptada se ve en la ficha con su texto alternativo', () => {
    view(apice({ image: { altText: 'Una huerta pixelada', png: new Uint8Array([137, 80, 78, 71]) } }), otra);
    expect(screen.getByRole('img', { name: 'Una huerta pixelada' })).toBeTruthy();
  });
});

describe('ApiceView · bloques (002)', () => {
  // Los controles de la ficha son de ProposalPanel, ReferenceManager, VisibilityControl y ArchiveControls;
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

  it('RF-4 (002) · 4.2: cada eje se muestra con su ícono y su nombre', () => {
    setup(apice({ axes: ['agua', 'cobijo'] }), { status: 'visitor' });
    const list = screen.getByRole('list', { name: 'Ejes' });
    expect(list.textContent).toBe('AguaCobijo');
    expect(list.querySelector('.axis-icon--agua')).toBeTruthy();
    expect(list.querySelector('.axis-icon--cobijo')).toBeTruthy();
  });

  it('RF-7 (002) · 7.1, 7.2: la imagen va en un edificio de 256 px como máximo', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const { container } = render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <ApiceView id="a1" source={fakeSource(apice({ image: { altText: 'Una huerta', png: new Uint8Array([1]) } })).source} client={fakeClient({}).client} />
      </SessionProvider>,
    );
    expect(container.querySelector('.building')).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Una huerta' });
    expect([img.style.width, img.style.height]).toEqual(['256px', '256px']);
  });

  it('RF-7 (002) · 7.4: sin imagen el edificio dice «Sin imagen»', () => {
    const { container } = render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <ApiceView id="a1" source={fakeSource(apice()).source} client={fakeClient({}).client} />
      </SessionProvider>,
    );
    expect(container.querySelector('.building')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Sin imagen' })).toBeTruthy();
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
    expect(tag(active, 'status')).toBe('prototipo');
    expect(tag(active, 'visibility')).toBe('público');
    cleanup();
    expect(tag(show(apice({ isArchived: true })), 'archived')).toBe('archivado');
  });
});
