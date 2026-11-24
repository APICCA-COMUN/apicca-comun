// RF-3 (022), D-1 (022), RF-1 (022) · 1.3, RF-4 (022) · 4.3: la siembra de demostración solo corre contra los emuladores
// de un proyecto `demo-`, resume lo que sembró y se detiene en la primera operación rechazada.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/errors';
import { checkTarget, formatSummary, runOperation, seedDemo, DEMO_ACCOUNTS, type DemoCtx } from './seed-demo';

const EMULATORS = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' };

describe('seed-demo · destino', () => {
  it('RF-3 (022): acepta los emuladores de un proyecto demo-', () => {
    expect(checkTarget(EMULATORS, 'demo-apicca')).toEqual({ ok: true });
  });

  it('RF-3 (022): rechaza un proyecto real aunque haya emuladores', () => {
    expect(checkTarget(EMULATORS, 'apicca-com')).toEqual({ ok: false, reason: expect.stringContaining('demo-') });
    expect(checkTarget(EMULATORS, '')).toMatchObject({ ok: false });
    expect(checkTarget(EMULATORS, undefined)).toMatchObject({ ok: false });
  });

  it('RF-3 (022): rechaza si falta el emulador de Firestore o el de Auth', () => {
    expect(checkTarget({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }, 'demo-apicca')).toEqual({
      ok: false,
      reason: expect.stringContaining('FIRESTORE_EMULATOR_HOST'),
    });
    expect(checkTarget({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '' }, 'demo-apicca')).toEqual({
      ok: false,
      reason: expect.stringContaining('FIREBASE_AUTH_EMULATOR_HOST'),
    });
  });

  it('RF-3 (022): sin emuladores y con un proyecto real, también rechaza', () => {
    expect(checkTarget({}, 'apicca-com')).toMatchObject({ ok: false });
  });
});

describe('seed-demo · guarda dentro de la siembra', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Un contexto que falla al tocarlo: si la siembra lo usa antes de comprobar el destino, la prueba lo delata. */
  const untouchable = new Proxy({}, {
    get: (_target, property) => {
      throw new Error(`La siembra tocó ctx.${String(property)} sin comprobar el destino.`);
    },
  }) as unknown as DemoCtx;

  it('RF-3 (022) · 3.2: llamada como función contra un proyecto real, se detiene sin borrar ni escribir', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(seedDemo(untouchable, { projectId: 'apicca-com', today: new Date(), env: EMULATORS })).rejects.toThrow(/demo-/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('RF-3 (022) · 3.2: llamada como función sin los emuladores, se detiene sin borrar ni escribir', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(seedDemo(untouchable, { projectId: 'demo-apicca', today: new Date(), env: {} })).rejects.toThrow(/FIRESTORE_EMULATOR_HOST/);
    await expect(seedDemo(untouchable, { projectId: 'demo-apicca', today: new Date(), env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' } })).rejects.toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('seed-demo · resumen', () => {
  const summary = { accounts: DEMO_ACCOUNTS, apices: { public: 17, private: 1, archived: 1 }, actions: 4, threads: 4 };

  it('RF-1 (022) · 1.3: el resumen separa los ápices en públicos, privados y archivados', () => {
    const text = formatSummary('demo-apicca', summary).join('\n');
    expect(text).toContain('17 públicos');
    expect(text).toContain('1 privado');
    expect(text).toContain('1 archivado');
    expect(text).toContain('4 caminos');
    expect(text).toContain('4 hilos');
  });

  it('RF-1 (022) · 1.3: el resumen lista las cuentas con su contraseña', () => {
    const text = formatSummary('demo-apicca', summary).join('\n');
    expect(text).toContain('demo-apicca');
    for (const account of DEMO_ACCOUNTS) expect(text).toContain(account.email);
    expect(text).toContain('facilitación');
  });
});

describe('seed-demo · operación rechazada', () => {
  it('RF-4 (022) · 4.3: una operación aceptada devuelve su resultado', async () => {
    await expect(runOperation('createApice «Huerta»', Promise.resolve({ id: 'a1' }))).resolves.toEqual({ id: 'a1' });
    await expect(runOperation('editApice «Huerta»', Promise.resolve({ ok: true, version: 2 }))).resolves.toEqual({ ok: true, version: 2 });
  });

  it('RF-4 (022) · 4.3: un `{ ok: false }` detiene la siembra con un error que nombra la operación', async () => {
    const conflict = Promise.resolve({ ok: false as const, conflict: true as const, current: { version: 3 } });
    await expect(runOperation('restoreVersion «Bicicleta»', conflict)).rejects.toThrow(/restoreVersion «Bicicleta»/);
    await expect(runOperation('openAmendment «Agua»', Promise.resolve({ ok: false as const, taken: true as const, amendmentId: 'x' }))).rejects.toThrow(/openAmendment «Agua»/);
  });

  it('RF-4 (022) · 4.3: una operación que lanza error detiene la siembra con un error que la nombra y trae el motivo', async () => {
    await expect(runOperation('joinCommonAction', Promise.reject(new ApiError('forbidden')))).rejects.toThrow(/joinCommonAction/);
    await expect(runOperation('joinCommonAction', Promise.reject(new ApiError('forbidden')))).rejects.toMatchObject({ operation: 'joinCommonAction', message: expect.stringContaining(new ApiError('forbidden').message) });
  });
});
