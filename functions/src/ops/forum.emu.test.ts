// RF-2 (018), D-T6 (018), D-T8 (018): cupo de ediciones de mensajes y edición sin cambios.
// T-3 (009) · RF-3 (009), RF-4 (009), RF-5 (009), RF-6 (009), RNF-2 (009), RNF-5 (009): ops de escritura del foro.
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../testing';
import { handleArchiveMessage } from './archiveMessage';
import { handleArchiveThread } from './archiveThread';
import { handleEditMessage } from './editMessage';
import { handleOpenThread } from './openThread';
import { handleReplyThread } from './replyThread';

let ctx: TestCtx;
let ana: string;
let beto: string;
let fabi: string;
let susi: string;

const open = (uid: string, over: Record<string, unknown> = {}) =>
  handleOpenThread(ctx, { title: '¿Cisterna o tanques?', axis: 'agua', text: 'Quiero comparar opciones.', ...over }, uid);
const codeOf = async (promise: Promise<unknown>) => ((await promise.then(() => null, (e: unknown) => e)) as { code?: string } | null)?.code ?? null;
const thread = async (id: string) => (await ctx.db.doc(`threads/${id}`).get()).data() as Record<string, unknown>;
const messages = async (id: string) => (await ctx.db.collection(`threads/${id}/messages`).orderBy('createdAt').get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>);

beforeEach(async () => {
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-10-10T12:00:00Z') });
  ana = (await seedAccount(ctx, { username: 'ana' })).uid;
  beto = (await seedAccount(ctx, { username: 'beto' })).uid;
  fabi = (await seedAccount(ctx, { username: 'fabi', role: 'facilitator' })).uid;
  susi = (await seedAccount(ctx, { username: 'susi', status: 'suspended' })).uid;
});

describe('foro · hilos', () => {
  it('RF-3 (009): abrir un hilo lo crea con autoría, fecha, eje y su primer mensaje', async () => {
    const { id } = await open(ana);
    expect(await thread(id)).toEqual(expect.objectContaining({ title: '¿Cisterna o tanques?', axis: 'agua', authorUid: ana, authorUsername: 'ana', messageCount: 1, isArchived: false }));
    expect(await messages(id)).toEqual([expect.objectContaining({ text: 'Quiero comparar opciones.', authorUsername: 'ana', editedAt: null, isArchived: false })]);
  });

  it('RF-3 (009) · 3.2: un título corto, un mensaje largo o un eje desconocido se rechazan', async () => {
    expect(await codeOf(open(ana, { title: 'ab' }))).toBe('invalid-request');
    expect(await codeOf(open(ana, { text: 'a'.repeat(2001) }))).toBe('text-too-long');
    expect(await codeOf(open(ana, { text: '   ' }))).toBe('text-empty');
    expect(await codeOf(open(ana, { axis: 'aire' }))).toBe('axis-unknown');
  });

  it('RF-3 (009): un visitante y una cuenta suspendida no abren hilos', async () => {
    expect(await codeOf(handleOpenThread(ctx, { title: 'Hola', axis: 'agua', text: 'x' }, null))).toBe('unauthenticated');
    expect(await codeOf(open(susi))).toBe('account-suspended');
  });

  it('RF-3 (009) · 3.3, RNF-5 (009): el hilo 11 en 24 horas se rechaza y pasado el día se admite', async () => {
    for (let i = 0; i < 10; i += 1) await open(ana);
    expect(await codeOf(open(ana))).toBe('rate-limited');
    expect(await codeOf(open(beto))).toBeNull();
    ctx.setNow(new Date('2026-10-11T12:00:01Z'));
    expect(await codeOf(open(ana))).toBeNull();
  });
});

describe('foro · respuestas', () => {
  it('RF-4 (009): responder añade el mensaje al final y actualiza actividad y conteo', async () => {
    const { id } = await open(ana);
    ctx.setNow(new Date('2026-10-10T13:00:00Z'));
    await handleReplyThread(ctx, { threadId: id, text: 'Yo prefiero tanques.' }, beto);
    const stored = await thread(id);
    expect(stored['messageCount']).toBe(2);
    expect((stored['lastMessageAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-10-10T13:00:00.000Z');
    expect((await messages(id)).map((m) => m['authorUsername'])).toEqual(['ana', 'beto']);
  });

  it('RF-4 (009) · 4.1: no se responde en un hilo archivado ni inexistente', async () => {
    const { id } = await open(ana);
    await handleArchiveThread(ctx, { threadId: id }, ana);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'x' }, beto))).toBe('thread-archived');
    expect(await codeOf(handleReplyThread(ctx, { threadId: 'nada', text: 'x' }, beto))).toBe('thread-not-found');
  });

  it('RF-4 (009): una cuenta suspendida no responde', async () => {
    const { id } = await open(ana);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'x' }, susi))).toBe('account-suspended');
  });
});

describe('foro · edición y archivo', () => {
  it('RF-6 (009): la autora edita su mensaje y queda la fecha de edición; otra persona no puede', async () => {
    const { id } = await open(ana);
    const reply = await handleReplyThread(ctx, { threadId: id, text: 'Primera' }, beto);
    ctx.setNow(new Date('2026-10-10T14:00:00Z'));
    await handleEditMessage(ctx, { threadId: id, messageId: reply.id, text: 'Corregida' }, beto);
    const edited = (await messages(id)).find((m) => m['id'] === reply.id);
    expect(edited).toEqual(expect.objectContaining({ text: 'Corregida' }));
    expect((edited?.['editedAt'] as { toDate(): Date }).toDate().toISOString()).toBe('2026-10-10T14:00:00.000Z');
    expect(await codeOf(handleEditMessage(ctx, { threadId: id, messageId: reply.id, text: 'Ajena' }, ana))).toBe('forbidden');
    expect(await codeOf(handleEditMessage(ctx, { threadId: id, messageId: reply.id, text: 'Ajena' }, fabi))).toBe('forbidden');
  });

  it('RF-5 (009): la autora y un facilitador archivan un hilo y queda quién y cuándo; otra persona no', async () => {
    const own = (await open(ana)).id;
    const other = (await open(ana)).id;
    expect(await codeOf(handleArchiveThread(ctx, { threadId: own }, beto))).toBe('forbidden');
    await handleArchiveThread(ctx, { threadId: own }, ana);
    await handleArchiveThread(ctx, { threadId: other }, fabi);
    expect(await thread(own)).toEqual(expect.objectContaining({ isArchived: true, archivedByUid: ana }));
    expect(await thread(other)).toEqual(expect.objectContaining({ isArchived: true, archivedByUid: fabi }));
    expect((await messages(own)).length).toBe(1);
  });

  it('RF-5 (009): se archiva un mensaje, baja el conteo y el mensaje de apertura no se archiva por separado', async () => {
    const { id } = await open(ana);
    const reply = await handleReplyThread(ctx, { threadId: id, text: 'Respuesta' }, beto);
    expect(await codeOf(handleArchiveMessage(ctx, { threadId: id, messageId: reply.id }, ana))).toBe('forbidden');
    await handleArchiveMessage(ctx, { threadId: id, messageId: reply.id }, fabi);
    expect((await thread(id))['messageCount']).toBe(1);
    expect((await messages(id)).find((m) => m['id'] === reply.id)).toEqual(expect.objectContaining({ isArchived: true, archivedByUid: fabi }));
    const first = (await messages(id))[0]?.['id'] as string;
    expect(await codeOf(handleArchiveMessage(ctx, { threadId: id, messageId: first }, ana))).toBe('forbidden');
  });
});

/** Siembra el contador diario de la persona en `count` (ventana abierta ahora) para no repetir decenas de llamadas. */
const seedDaily = (kind: string, uid: string, count: number) =>
  ctx.db.doc(`rateLimits/daily-${kind}-${uid}`).set({ count, windowStart: ctx.now(), expiresAt: new Date(ctx.now().getTime() + 24 * 3600 * 1000) });

describe('foro · cuota diaria de respuestas', () => {
  it('RF-7 (016) · 7.1: la respuesta 51 en 24 horas se rechaza con rate-limited y no escribe; otra persona no se ve afectada', async () => {
    const { id } = await open(fabi);
    await seedDaily('reply', ana, 49);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'La 50.' }, ana))).toBeNull();
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'La 51.' }, ana))).toBe('rate-limited');
    // Con el reloj fijo las respuestas comparten fecha: se compara sin orden.
    expect((await messages(id)).map((m) => m['text']).sort()).toEqual(['La 50.', 'Quiero comparar opciones.']);
    expect((await thread(id))['messageCount']).toBe(2);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'Desde beto.' }, beto))).toBeNull();
    expect((await messages(id)).map((m) => m['authorUsername']).sort()).toEqual(['ana', 'beto', 'fabi']);
  });

  it('RF-7 (016) · 7.1: una respuesta inválida no gasta cupo y editar un mensaje no cobra la cuota de respuestas', async () => {
    const { id } = await open(fabi);
    await seedDaily('reply', ana, 49);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: '   ' }, ana))).toBe('text-empty');
    expect((await ctx.db.doc(`rateLimits/daily-reply-${ana}`).get()).get('count')).toBe(49);
    const { id: messageId } = await handleReplyThread(ctx, { threadId: id, text: 'Primera.' }, ana);
    await handleEditMessage(ctx, { threadId: id, messageId, text: 'Primera, editada.' }, ana);
    expect((await ctx.db.doc(`rateLimits/daily-reply-${ana}`).get()).get('count')).toBe(50);
  });

  it('RF-3 (017) · 3.1: una respuesta rechazada (hilo archivado o inexistente) no descuenta el cupo (D-3 (017))', async () => {
    const { id } = await open(fabi);
    await handleArchiveThread(ctx, { threadId: id }, fabi);
    await seedDaily('reply', ana, 49);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'Tarde.' }, ana))).toBe('thread-archived');
    expect(await codeOf(handleReplyThread(ctx, { threadId: 'nada', text: 'Nada.' }, ana))).toBe('thread-not-found');
    expect((await ctx.db.doc(`rateLimits/daily-reply-${ana}`).get()).get('count')).toBe(49);
  });

  it('RF-3 (017) · 3.2: con el cupo agotado la respuesta se sigue rechazando con rate-limited', async () => {
    const { id } = await open(fabi);
    await seedDaily('reply', ana, 50);
    expect(await codeOf(handleReplyThread(ctx, { threadId: id, text: 'Una más.' }, ana))).toBe('rate-limited');
    expect((await messages(id)).length).toBe(1);
  });

  it('RF-3 (017) · 3.1: abrir un hilo descuenta el cupo en la misma escritura que lo crea', async () => {
    await open(ana);
    expect((await ctx.db.doc(`rateLimits/forum-thread-${ana}`).get()).get('count')).toBe(1);
    expect((await ctx.db.collection('threads').get()).size).toBe(1);
  });
});

const seedEditQuota = (uid: string, count: number) => seedDaily('edit', uid, count);
const editCount = async (uid: string) => (await ctx.db.doc(`rateLimits/daily-edit-${uid}`).get()).get('count') as number | undefined;

describe('foro · cupo de ediciones (RF-2 (018))', () => {
  const reply = async (threadId: string, text = 'Primera') => (await handleReplyThread(ctx, { threadId, text }, beto)).id;

  it('RF-2 (018) · 2.1: editar un mensaje cobra una unidad del cupo diario de ediciones', async () => {
    const { id } = await open(ana);
    const messageId = await reply(id);
    await handleEditMessage(ctx, { threadId: id, messageId, text: 'Corregida' }, beto);
    expect(await editCount(beto)).toBe(1);
  });

  it('RF-2 (018) · 2.2: con el cupo agotado responde rate-limited y no escribe', async () => {
    const { id } = await open(ana);
    const messageId = await reply(id);
    await seedEditQuota(beto, 100);
    expect(await codeOf(handleEditMessage(ctx, { threadId: id, messageId, text: 'Corregida' }, beto))).toBe('rate-limited');
    expect((await messages(id)).find((m) => m['id'] === messageId)).toEqual(expect.objectContaining({ text: 'Primera' }));
    expect(await editCount(beto)).toBe(100);
  });

  it('RF-2 (018) · 2.3: una edición rechazada (mensaje ajeno) no cobra', async () => {
    const { id } = await open(ana);
    const messageId = await reply(id);
    expect(await codeOf(handleEditMessage(ctx, { threadId: id, messageId, text: 'Ajena' }, ana))).toBe('forbidden');
    expect(await editCount(ana)).toBeUndefined();
  });

  it('RF-2 (018) · 2.3: con el texto igual al vigente responde con éxito sin escribir ni cobrar (D-T8 (018))', async () => {
    const { id } = await open(ana);
    const messageId = await reply(id);
    await seedEditQuota(beto, 100);
    expect(await codeOf(handleEditMessage(ctx, { threadId: id, messageId, text: 'Primera' }, beto))).toBeNull();
    const stored = (await messages(id)).find((m) => m['id'] === messageId);
    expect(stored?.['editedAt'] ?? null).toBeNull();
    expect(await editCount(beto)).toBe(100);
  });
});
