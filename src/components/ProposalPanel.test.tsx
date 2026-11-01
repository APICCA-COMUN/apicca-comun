import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type ApiOps, type MediaOps, type OpClient } from '../data/api';
import type { ProposalRow, ProposalSource } from '../data/proposals';
import { fakeClient } from '../testing/facilitationDoubles';
import { ProposalPanel } from './ProposalPanel';
import { blockProblems, expectBlocks } from '../testing/expectBlocks';
import { expectOnePrimary } from '../testing/expectActions';

type Status = ApiOps['generationStatus']['out'];
const status = (extra: Partial<Status> = {}): Status => ({
  remaining: 2,
  limit: 3,
  resetAt: '2026-10-08T05:00:00.000Z', // medianoche en Colombia
  blockedUntil: null,
  ...extra,
});

// PNG mínimo (cabecera): al panel le basta con bytes; jsdom no decodifica.
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const NOW = Date.parse('2026-10-07T12:00:00Z');

function fakeProposals(initial: ProposalRow | null) {
  let listener: ((row: ProposalRow | null) => void) | null = null;
  const source: ProposalSource = {
    onProposal(_id, _uid, callback) {
      listener = callback;
      callback(initial);
      return () => undefined;
    },
  };
  return { source, set: (row: ProposalRow | null) => act(() => listener?.(row)) };
}

function fakeMedia(handler: () => MediaOps['generateImage']['out'] | Promise<MediaOps['generateImage']['out']>) {
  const calls: unknown[] = [];
  const client = {
    async call(op: string, payload: unknown) {
      calls.push({ op, payload });
      return handler();
    },
  } as OpClient<MediaOps>;
  return { client, calls };
}

interface Setup {
  status?: Status | Error;
  proposal?: ProposalRow | null;
  canGenerate?: boolean;
  api?: Parameters<typeof fakeClient>[0];
  media?: ReturnType<typeof fakeMedia>;
}

function setup(options: Setup = {}) {
  const api = fakeClient({
    generationStatus: () => {
      const value = options.status ?? status();
      if (value instanceof Error) throw value;
      return value;
    },
    ...options.api,
  } as Parameters<typeof fakeClient>[0]);
  const media = options.media ?? fakeMedia(() => ({}));
  const proposals = fakeProposals(options.proposal ?? null);
  render(
    <ProposalPanel
      apiceId="a1"
      uid="u1"
      canGenerate={options.canGenerate ?? true}
      source={proposals.source}
      client={api.client}
      mediaClient={media.client}
      now={() => NOW}
    />,
  );
  return { api, media, proposals };
}

describe('ProposalPanel · generar', () => {
  it('RF-19 (001): muestra cuántas generaciones quedan hoy y cuándo se reinician, en hora de Colombia', async () => {
    setup();
    expect(await screen.findByText(/Te quedan 2 de 3 generaciones hoy/)).toBeTruthy();
    expect(screen.getByText(/12:00/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Generar imagen' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('RF-19 (001): con el tope alcanzado deshabilita generar e indica la hora de reinicio', async () => {
    setup({ status: status({ remaining: 0 }) });
    expect(await screen.findByText(/Ya usaste tus 3 generaciones de hoy/)).toBeTruthy();
    expect(screen.getByText(/12:00/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Generar imagen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('RF-20 (001): con un bloqueo activo deshabilita generar y dice hasta cuándo', async () => {
    setup({ status: status({ blockedUntil: '2026-10-07T12:15:00.000Z' }) });
    expect(await screen.findByText(/Generar está en pausa/)).toBeTruthy();
    expect(screen.getByText(/7:15/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Generar imagen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('RF-17 (001): generar llama a generateImage con el ápice y vuelve a pedir lo que queda', async () => {
    const media = fakeMedia(() => ({}));
    const { api } = setup({ media });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Generar imagen' }));
    await waitFor(() => expect(media.calls).toEqual([{ op: 'generateImage', payload: { id: 'a1' } }]));
    await waitFor(() => expect(api.calls.filter((c) => c.op === 'generationStatus')).toHaveLength(2));
  });

  it('RF-20 (001): si la generación falla muestra el mensaje y deja reintentar', async () => {
    let attempts = 0;
    const media = fakeMedia(() => {
      attempts += 1;
      if (attempts === 1) throw new ApiClientError('rate-limited');
      return {};
    });
    setup({ media });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Generar imagen' }));
    expect((await screen.findByRole('alert')).textContent).toContain('demasiados intentos');
    expect((screen.getByRole('button', { name: 'Generar imagen' }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Generar imagen' }));
    await waitFor(() => expect(media.calls).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('RF-20 (001): sin generación disponible lo dice, deshabilita generar y no rompe el resto', async () => {
    setup({ status: new Error('caído') });
    expect(await screen.findByText(/La generación no está disponible por ahora/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Generar imagen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('RF-17 (001): quien no puede editar no ve el botón de generar', async () => {
    setup({ canGenerate: false });
    expect(screen.queryByRole('button', { name: 'Generar imagen' })).toBeNull();
  });
});

describe('ProposalPanel · decidir', () => {
  const proposal: ProposalRow = { png, createdAt: { seconds: NOW / 1000 - 3600, nanoseconds: 0 }, expiresAt: { seconds: NOW / 1000 + 3600, nanoseconds: 0 } };

  it('RF-17 (001): muestra la propuesta propia con su texto alternativo pendiente', async () => {
    setup({ proposal });
    expect(await screen.findByRole('img', { name: 'Propuesta de imagen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aceptar propuesta' })).toBeTruthy();
  });

  it('RF-18 (001): aceptar exige el texto alternativo y no llama a la op sin él', async () => {
    const { api } = setup({ proposal, api: { acceptProposal: () => ({ ok: true }) } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aceptar propuesta' }));
    expect((await screen.findByRole('alert')).textContent).toContain('texto alternativo');
    expect(api.calls.filter((c) => c.op === 'acceptProposal')).toHaveLength(0);
  });

  it('RF-18 (001): aceptar con texto alternativo llama a acceptProposal', async () => {
    const { api } = setup({ proposal, api: { acceptProposal: () => ({ ok: true }) } });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Texto alternativo'), '  Una huerta pixelada  ');
    await user.click(screen.getByRole('button', { name: 'Aceptar propuesta' }));
    await waitFor(() =>
      expect(api.calls.filter((c) => c.op === 'acceptProposal')).toEqual([
        { op: 'acceptProposal', payload: { id: 'a1', altText: 'Una huerta pixelada' } },
      ]),
    );
  });

  it('RF-18 (001): ante un aviso de propuesta vieja lo muestra y acepta solo tras confirmar', async () => {
    let calls = 0;
    const { api } = setup({
      proposal,
      api: {
        acceptProposal: () => {
          calls += 1;
          return calls === 1 ? { ok: false, warnings: ['content-changed', 'reference-removed'] } : { ok: true };
        },
      },
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Texto alternativo'), 'Huerta');
    await user.click(screen.getByRole('button', { name: 'Aceptar propuesta' }));
    expect((await screen.findByRole('alert')).textContent).toContain('cambió el contenido del ápice');
    expect(screen.getByRole('alert').textContent).toContain('referencia que ya se quitó');
    await user.click(screen.getByRole('button', { name: 'Aceptar de todos modos' }));
    await waitFor(() =>
      expect(api.calls.filter((c) => c.op === 'acceptProposal').map((c) => c.payload)).toEqual([
        { id: 'a1', altText: 'Huerta' },
        { id: 'a1', altText: 'Huerta', confirm: true },
      ]),
    );
  });

  it('RF-18 (001): descartar llama a discardProposal', async () => {
    const { api } = setup({ proposal, api: { discardProposal: () => ({}) } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Descartar propuesta' }));
    await waitFor(() => expect(api.calls.filter((c) => c.op === 'discardProposal')).toEqual([{ op: 'discardProposal', payload: { id: 'a1' } }]));
  });

  it('RF-17 (001): una propuesta caducada se avisa y ya no se puede aceptar', async () => {
    setup({ proposal: { png, expiresAt: { seconds: NOW / 1000 - 60, nanoseconds: 0 } } });
    expect(await screen.findByText(/La propuesta caducó/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aceptar propuesta' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar propuesta' })).toBeTruthy();
  });

  it('RF-17 (001): si la propuesta desaparece (se aceptó o descartó) el panel vuelve a ofrecer generar', async () => {
    const { proposals } = setup({ proposal });
    await screen.findByRole('img', { name: 'Propuesta de imagen' });
    proposals.set(null);
    expect(screen.queryByRole('img', { name: 'Propuesta de imagen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generar imagen' })).toBeTruthy();
  });
});

/** Estilos en línea con un tamaño escrito a mano (RF-2 (002) · 2.1, D-T20 (002)). El lado 64·n de la imagen
 *  del edificio lo calcula el dominio y no cuenta (D-T10 (002)). */
const fixedSizes = (container: ParentNode): string[] =>
  [...container.querySelectorAll<HTMLElement>('[style]')]
    .filter((el) => !el.matches('.building .pixel-image'))
    .filter((el) =>
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size', 'padding', 'margin', 'top', 'left'].some(
        (property) => el.style.getPropertyValue(property) !== '',
      ),
    )
    .map((el) => el.outerHTML.slice(0, 80));

describe('ProposalPanel · bloques (002)', () => {
  const proposal = (): ProposalRow => ({ png, createdAt: { seconds: NOW / 1000, nanoseconds: 0 }, expiresAt: { seconds: NOW / 1000 + 3600, nanoseconds: 0 } }) as ProposalRow;
  const actionOf = (name: string) => screen.getByRole('button', { name });

  it('RF-4 (003) · 4.8: con propuesta sin advertencias, «Aceptar propuesta» es la única azul; Generar y Descartar son secundarias', async () => {
    setup({ proposal: proposal() });
    await screen.findByRole('button', { name: 'Generar imagen' });
    expect(actionOf('Generar imagen').classList.contains('action-secondary')).toBe(true);
    expect(actionOf('Aceptar propuesta').classList.contains('action-primary')).toBe(true);
    expect(actionOf('Descartar propuesta').classList.contains('action-secondary')).toBe(true);
    expectOnePrimary(document.body, 'Aceptar propuesta');
  });

  it('RF-4 (003) · 4.11: con advertencias, «Aceptar de todos modos» es destructiva y no hay botón azul', async () => {
    setup({
      proposal: proposal(),
      api: { acceptProposal: () => ({ ok: false, warnings: ['content-changed'] }) } as never,
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Texto alternativo'), 'Un pozo');
    await user.click(actionOf('Aceptar propuesta'));
    expect((await screen.findByRole('button', { name: 'Aceptar de todos modos' })).classList.contains('action-destructive')).toBe(true);
    expectOnePrimary(document.body, null);
    expect(blockProblems(document.body)).toEqual([]);
  });

  it('RF-4 (003) · 4.8: sin propuesta no hay botón azul y Generar imagen es secundaria', async () => {
    setup({ proposal: null });
    await screen.findByRole('button', { name: 'Generar imagen' });
    expect(actionOf('Generar imagen').classList.contains('action-secondary')).toBe(true);
    expectOnePrimary(document.body, null);
  });

  it('RF-6 (002) · 6.1: todos los controles y avisos del panel son bloques', async () => {
    setup({ proposal: proposal(), status: new Error('x') });
    await screen.findByText(/no está disponible/);
    expectBlocks(document.body);
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', async () => {
    setup({ proposal: proposal() });
    await screen.findByRole('button', { name: 'Generar imagen' });
    expectBlocks(document.body, { nesting: true });
  });

  it('RF-2 (002) · 2.1: ningún estilo en línea con color ni con tamaño escrito a mano', async () => {
    setup({ proposal: proposal() });
    await screen.findByRole('button', { name: 'Generar imagen' });
    expect(blockProblems(document.body).filter((p) => p.startsWith('color'))).toEqual([]);
    expect(fixedSizes(document.body)).toEqual([]);
  });
});

describe('ProposalPanel · identidad (002)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RF-7 (002) · 7.1, 7.2: la propuesta se muestra en un edificio con los ejes del ápice, de 128 px como máximo', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const api = fakeClient({ generationStatus: () => status() } as Parameters<typeof fakeClient>[0]);
    const proposals = fakeProposals({ png });
    const { container } = render(
      <ProposalPanel
        apiceId="a1"
        uid="u1"
        canGenerate
        axes={['cobijo', 'agua']}
        source={proposals.source}
        client={api.client}
        mediaClient={fakeMedia(() => ({})).client}
        now={() => NOW}
      />,
    );
    const img = await screen.findByRole('img', { name: 'Propuesta de imagen' });
    expect(container.querySelector('.building')).toBeTruthy();
    expect([img.style.width, img.style.height]).toEqual(['128px', '128px']);
    expect(container.querySelector('.building .axis-icon--agua')).toBeTruthy();
    expect(container.querySelector('.building .axis-icon--cobijo')).toBeTruthy();
  });
});
