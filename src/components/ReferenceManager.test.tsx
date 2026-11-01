import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { REFERENCE_MAX_BYTES } from '../../shared/domain/images';
import { ApiClientError, type ApiOps, type MediaOps, type OpClient } from '../data/api';
import type { ReferenceRow, ReferenceSource, ReferenceUploader } from '../data/references';
import { fakeClient } from '../testing/facilitationDoubles';
import { ReferenceManager } from './ReferenceManager';
import { blockProblems, expectBlocks } from '../testing/expectBlocks';

const row = (id: string, extra: Partial<ReferenceRow> = {}): ReferenceRow => ({
  id,
  altText: `Referencia ${id}`,
  contentType: 'image/png',
  bytes: 1000,
  path: `apices/a1/references/${id}`,
  uploadedByUsername: 'ana',
  isRemoved: false,
  removal: null,
  ...extra,
});

/** Fuente en memoria: respeta que quien no facilita nunca pida las quitadas. */
function fakeSource(initial: ReferenceRow[], failImage = false) {
  let rows = initial;
  const requests: boolean[] = [];
  let listener: ((rows: ReferenceRow[]) => void) | null = null;
  const source: ReferenceSource = {
    onReferences(_id, { includeRemoved }, callback) {
      requests.push(includeRemoved);
      listener = callback;
      callback(includeRemoved ? rows : rows.filter((r) => !r.isRemoved));
      return () => undefined;
    },
    async readImage(apiceId, refId) {
      if (failImage) throw new Error('sin imagen');
      return `blob:apices/${apiceId}/references/${refId}`;
    },
  };
  return {
    source,
    requests,
    set(next: ReferenceRow[]) {
      rows = next;
      act(() => listener?.(next.filter((r) => !r.isRemoved)));
    },
  };
}

function fakeMedia(handler: (payload: MediaOps['addReference']['in']) => MediaOps['addReference']['out']) {
  const calls: unknown[] = [];
  const client = {
    async call(_op: string, payload: unknown) {
      calls.push(payload);
      return handler(payload as MediaOps['addReference']['in']);
    },
  } as OpClient<MediaOps>;
  return { client, calls };
}

const okUploader = (): { uploader: ReferenceUploader; files: File[] } => {
  const files: File[] = [];
  return {
    files,
    uploader: {
      async upload(file, onProgress) {
        files.push(file);
        onProgress(1);
        return 'up-1';
      },
    },
  };
};

const png = (name = 'tanque.png', bytes = 1000) => {
  const file = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
};

const noApi = fakeClient({}).client;

function setup(opts: {
  rows?: ReferenceRow[];
  canEdit?: boolean;
  isFacilitator?: boolean;
  api?: OpClient<ApiOps>;
  media?: OpClient<MediaOps>;
  uploader?: ReferenceUploader;
  failImage?: boolean;
}) {
  const src = fakeSource(opts.rows ?? [], opts.failImage);
  render(
    <ReferenceManager
      apiceId="a1"
      canEdit={opts.canEdit ?? true}
      isFacilitator={opts.isFacilitator ?? false}
      source={src.source}
      uploader={opts.uploader ?? okUploader().uploader}
      mediaClient={opts.media ?? fakeMedia(() => ({ refId: 'r9' })).client}
      client={opts.api ?? noApi}
    />,
  );
  return src;
}

async function fill(file: File | null, alt: string) {
  if (file !== null) await userEvent.upload(screen.getByLabelText(/imagen de referencia/i), file);
  if (alt !== '') await userEvent.type(screen.getByLabelText(/texto alternativo/i), alt);
}

describe('ReferenceManager · subir', () => {
  it('RF-15 (001): una subida válida sube el archivo y llama a addReference con el texto recortado', async () => {
    const { uploader, files } = okUploader();
    const media = fakeMedia(() => ({ refId: 'r9' }));
    setup({ uploader, media: media.client });
    await fill(png(), '  Un tanque  ');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    await waitFor(() => expect(media.calls).toEqual([{ id: 'a1', uploadId: 'up-1', altText: 'Un tanque' }]));
    expect(files).toHaveLength(1);
  });

  it('RF-15 (001): un archivo de más de 5 MB se rechaza en el cliente con su mensaje y no se sube', async () => {
    const { uploader, files } = okUploader();
    setup({ uploader });
    await fill(png('grande.png', REFERENCE_MAX_BYTES + 1), 'Grande');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    expect((await screen.findByRole('alert')).textContent).toContain('5 MB');
    expect(files).toHaveLength(0);
  });

  it('RF-15 (001): un tipo no admitido se rechaza con su mensaje', async () => {
    const { uploader, files } = okUploader();
    setup({ uploader });
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    await userEvent.upload(screen.getByLabelText(/imagen de referencia/i), gif, { applyAccept: false });
    await userEvent.type(screen.getByLabelText(/texto alternativo/i), 'Animada');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    expect((await screen.findByRole('alert')).textContent).toContain('JPG, PNG o WebP');
    expect(files).toHaveLength(0);
  });

  it('RF-15 (001): con cinco referencias la sexta se rechaza e indica el máximo', async () => {
    const rows = ['1', '2', '3', '4', '5'].map((id) => row(id));
    const { uploader, files } = okUploader();
    setup({ rows, uploader });
    await fill(png(), 'Sexta');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    expect((await screen.findByRole('alert')).textContent).toContain('máximo de 5');
    expect(files).toHaveLength(0);
  });

  it('RF-15 (001): el texto alternativo es obligatorio y uno en blanco se rechaza', async () => {
    const { uploader, files } = okUploader();
    setup({ uploader });
    await fill(png(), '');
    await userEvent.type(screen.getByLabelText(/texto alternativo/i), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    expect((await screen.findByRole('alert')).textContent).toContain('texto alternativo');
    expect(files).toHaveLength(0);
  });

  it('RF-15 (001): sin elegir archivo pide elegirlo', async () => {
    setup({});
    await userEvent.type(screen.getByLabelText(/texto alternativo/i), 'Algo');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/elige una imagen/i);
  });

  it('RF-15 (001): mientras sube muestra el progreso', async () => {
    let finish: (id: string) => void = () => undefined;
    let report: (fraction: number) => void = () => undefined;
    const uploader: ReferenceUploader = {
      upload: (_file, onProgress) => {
        report = onProgress;
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      },
    };
    setup({ uploader });
    await fill(png(), 'Tanque');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    act(() => report(0.5));
    const bar = await screen.findByRole('progressbar');
    expect(bar.getAttribute('value')).toBe('50');
    await act(async () => finish('up-2'));
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  });

  it('RF-15 (001): si el servidor rechaza la subida muestra su mensaje', async () => {
    const media = fakeMedia(() => {
      throw new ApiClientError('image-unreadable');
    });
    setup({ media: media.client });
    await fill(png(), 'Tanque');
    await userEvent.click(screen.getByRole('button', { name: 'Subir referencia' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo leer');
  });

  it('RF-15 (001): lista las referencias con su texto alternativo', async () => {
    setup({ rows: [row('r1', { altText: 'Tanque azul' })] });
    const img = await screen.findByRole('img', { name: 'Tanque azul' });
    expect(img.getAttribute('src')).toBe('blob:apices/a1/references/r1');
  });

  it('RF-5 (007): si la imagen no se puede obtener muestra un aviso en lugar de «Cargando imagen…»', async () => {
    setup({ rows: [row('r1')], failImage: true });
    expect(await screen.findByText('No se pudo cargar la imagen.')).toBeTruthy();
    expect(screen.queryByText('Cargando imagen…')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Referencia r1' })).toBeNull();
  });

  it('RF-15 (001): quien no puede editar no ve el formulario de subida', () => {
    setup({ canEdit: false, rows: [row('r1')] });
    expect(screen.queryByRole('button', { name: 'Subir referencia' })).toBeNull();
  });
});

describe('ReferenceManager · quitar', () => {
  it('RF-16 (001): quitar una referencia llama a removeReference y desaparece de la lista', async () => {
    const api = fakeClient({ removeReference: () => ({}) });
    const src = setup({ rows: [row('r1', { uploadedByUsername: 'beto' })], api: api.client });
    await userEvent.click(await screen.findByRole('button', { name: /Quitar referencia/ }));
    expect(api.calls).toEqual([{ op: 'removeReference', payload: { id: 'a1', refId: 'r1' } }]);
    src.set([row('r1', { isRemoved: true })]);
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Referencia r1' })).toBeNull());
  });

  it('RF-16 (001): en un ápice archivado el control de quitar no existe', async () => {
    setup({ canEdit: false, rows: [row('r1')] });
    await screen.findByRole('img', { name: 'Referencia r1' });
    expect(screen.queryByRole('button', { name: /Quitar referencia/ })).toBeNull();
  });

  it('RF-16 (001): si quitar falla muestra el mensaje', async () => {
    const api = fakeClient({
      removeReference: () => {
        throw new ApiClientError('apice-archived');
      },
    });
    setup({ rows: [row('r1')], api: api.client });
    await userEvent.click(await screen.findByRole('button', { name: /Quitar referencia/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('archivado');
  });
});

describe('ReferenceManager · retiro por facilitadores', () => {
  const removed = row('r2', {
    altText: 'Foto quitada',
    isRemoved: true,
    removal: { kind: 'retracted', byUsername: 'fabi', reason: 'Aparece una persona sin permiso' },
  });

  it('RF-16 (001): la facilitación ve la lista de quitadas y retiradas con quién y el motivo', async () => {
    const src = setup({ rows: [row('r1'), removed], isFacilitator: true });
    expect(src.requests).toEqual([true]);
    const region = await screen.findByRole('region', { name: /quitadas o retiradas/i });
    expect(region.textContent).toContain('Foto quitada');
    expect(region.textContent).toContain('fabi');
    expect(region.textContent).toContain('Aparece una persona sin permiso');
  });

  it('RF-16 (001): otra persona no pide ni ve las quitadas', async () => {
    const src = setup({ rows: [row('r1'), removed], isFacilitator: false });
    await screen.findByRole('img', { name: 'Referencia r1' });
    expect(src.requests).toEqual([false]);
    expect(screen.queryByRole('region', { name: /quitadas o retiradas/i })).toBeNull();
    expect(screen.queryByText('Foto quitada')).toBeNull();
    expect(screen.queryByRole('button', { name: /Retirar/ })).toBeNull();
  });

  it('RF-16 (001): el retiro exige el motivo y luego llama a retractImage', async () => {
    const api = fakeClient({ retractImage: () => ({}) });
    setup({ rows: [row('r1')], isFacilitator: true, api: api.client });
    await userEvent.click(await screen.findByRole('button', { name: /Retirar referencia/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
    expect((await screen.findByRole('alert')).textContent).toContain('motivo');
    expect(api.calls).toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/motivo del retiro/i), '  Sin permiso  ');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
    await waitFor(() =>
      expect(api.calls).toEqual([
        { op: 'retractImage', payload: { id: 'a1', refId: 'r1', reason: 'Sin permiso' } },
      ]),
    );
  });

  it('RF-16 (001): la facilitación puede retirar aunque el ápice esté archivado', async () => {
    setup({ rows: [row('r1')], canEdit: false, isFacilitator: true });
    const item = (await screen.findByRole('img', { name: 'Referencia r1' })).closest('li') as HTMLElement;
    expect(within(item).getByRole('button', { name: /Retirar referencia/ })).toBeTruthy();
    expect(within(item).queryByRole('button', { name: /Quitar referencia/ })).toBeNull();
  });
});

/** Estilos en línea con un tamaño escrito a mano (RF-2 (002) · 2.1, D-T20 (002)). */
const fixedSizes = (container: ParentNode): string[] =>
  [...container.querySelectorAll<HTMLElement>('[style]')]
    .filter((el) =>
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size', 'padding', 'margin', 'top', 'left'].some(
        (property) => el.style.getPropertyValue(property) !== '',
      ),
    )
    .map((el) => el.outerHTML.slice(0, 80));

describe('ReferenceManager · bloques (002)', () => {
  it('RF-4 (003) · 4.8: Retirar y Confirmar retiro (piden motivo) son destructivas; Quitar, Cancelar y Subir referencia son secundarias', async () => {
    setup({ rows: [row('r1')], isFacilitator: true });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Quitar referencia: Referencia r1' });
    const cls = (name: string) => screen.getByRole('button', { name }).classList;
    expect(cls('Quitar referencia: Referencia r1').contains('action-secondary')).toBe(true);
    expect(cls('Retirar referencia: Referencia r1').contains('action-destructive')).toBe(true);
    expect(cls('Subir referencia').contains('action-secondary')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Retirar referencia: Referencia r1' }));
    expect(cls('Confirmar retiro').contains('action-destructive')).toBe(true);
    expect(cls('Cancelar').contains('action-secondary')).toBe(true);
  });

  it('RF-6 (002) · 6.1: controles, avisos y estado de carga de la imagen son bloques', async () => {
    setup({ rows: [row('r1'), row('r2', { isRemoved: true, removal: { kind: 'retracted', byUsername: 'ma', reason: 'x' } as never })], isFacilitator: true });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Retirar referencia: Referencia r1' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
    await screen.findByRole('alert');
    expectBlocks(document.body);
  });

  it('RF-3 (003) · 3.3: no contiene bloques anidados', async () => {
    setup({ rows: [row('r1')], isFacilitator: true });
    await screen.findByRole('img', { name: 'Referencia r1' });
    expectBlocks(document.body, { nesting: true });
  });

  it('RF-2 (002) · 2.1: sin estilos en línea con color ni con tamaño escrito a mano', async () => {
    setup({ rows: [row('r1')] });
    await screen.findByRole('img', { name: 'Referencia r1' });
    expect(blockProblems(document.body).filter((p) => p.startsWith('color'))).toEqual([]);
    expect(fixedSizes(document.body)).toEqual([]);
  });
});

describe('ReferenceManager · etiquetas (002)', () => {
  it('RF-13 (002) · 13.1, 13.3: la referencia retirada o quitada es una etiqueta con el texto de la 001', async () => {
    setup({
      rows: [
        row('r1', { isRemoved: true, removal: { kind: 'retracted', byUsername: 'ma', reason: 'x' } as never }),
        row('r2', { isRemoved: true, removal: { kind: 'removed', byUsername: 'ana' } as never }),
      ],
      isFacilitator: true,
    });
    await screen.findByRole('region', { name: /quitadas o retiradas/i });
    const tags = [...document.querySelectorAll('.tag[data-condition="reference"]')].map((tag) => tag.textContent);
    expect(tags).toEqual(['Retirada', 'Quitada']);
  });
});
