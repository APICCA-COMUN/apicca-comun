// RF-1 (022) · 1.3, RF-2 (022), RF-3 (022), RF-4 (022), RF-5 (022), D-T1 (022) a D-T11 (022) · Datos de demostración para
// recorrer el sitio en local: cinco participantes ficticios con ápices, caminos, Plaza, constitución, facilitación y
// avisos. Todo, salvo las cuentas, pasa por las operaciones del servidor (`functions/src/ops`), con un reloj que avanza
// desde hace 21 días hasta ayer, siempre entre las 8:00 y las 20:00 de Bogotá.
//
// Uso: `npm run demo` desde la raíz. Solo corre contra los emuladores de un proyecto `demo-` (RF-3 (022)).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomBytes } from 'node:crypto';
import type { AccountDoc, Role } from '../../shared/domain/accounts';
import type { Ctx } from '../src/context';
import { handleAgreeAmendment } from '../src/ops/agreeAmendment';
import { handleArchiveApice } from '../src/ops/archiveApice';
import { handleArchiveMessage } from '../src/ops/archiveMessage';
import { handleCommentAmendment } from '../src/ops/commentAmendment';
import { handleCreateApice } from '../src/ops/createApice';
import { handleEditApice } from '../src/ops/editApice';
import { handleEditCommonAction } from '../src/ops/editCommonAction';
import { handleEditMessage } from '../src/ops/editMessage';
import { handleInvite } from '../src/ops/invite';
import { handleJoinCommonAction } from '../src/ops/joinCommonAction';
import { handleMarkNoticesSeen } from '../src/ops/markNoticesSeen';
import { handleObjectAmendment } from '../src/ops/objectAmendment';
import { handleOpenAmendment } from '../src/ops/openAmendment';
import { handleOpenConstitution } from '../src/ops/openConstitution';
import { handleOpenThread } from '../src/ops/openThread';
import { handleProposeCommonAction } from '../src/ops/proposeCommonAction';
import { handleReplyThread } from '../src/ops/replyThread';
import { handleRequestEnrollment } from '../src/ops/requestEnrollment';
import { handleRestoreVersion } from '../src/ops/restoreVersion';
import { handleSaveDocument } from '../src/ops/saveDocument';
import { handleSaveSection } from '../src/ops/saveSection';
import { handleSetCommonActionStatus } from '../src/ops/setCommonActionStatus';
import { handleSetVisibility } from '../src/ops/setVisibility';
import { handleSettleAmendments } from '../src/ops/settleAmendments';
import { zoneOf } from '../src/zone';

/** El `Ctx` de las operaciones con un reloj que la siembra puede mover (D-T2 (022)). */
export interface DemoCtx extends Ctx {
  setNow(date: Date): void;
}

export interface DemoAccount {
  uid: string;
  username: string;
  name: string;
  email: string;
  role: Role;
}

/** La misma contraseña para todas las cuentas: solo existe en los emuladores (D-T3 (022)). */
export const DEMO_PASSWORD = 'demo-apicca';

const account = (key: string, username: string, name: string, role: Role = 'member'): DemoAccount => ({
  uid: `demo-${key}`,
  username,
  name,
  email: `${username}@demo.apicca`,
  role,
});

/** Las cinco participantes ficticias (RF-2 (022) · 2.1). */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  account('ana', 'ana_agua', 'Ana Agua', 'facilitator'),
  account('beto', 'beto_huerta', 'Beto Huerta'),
  account('carla', 'carla_techo', 'Carla Techo'),
  account('dario', 'dario_sol', 'Darío Sol'),
  account('eli', 'eli_radio', 'Eli Radio'),
];

/** RF-3 (022): solo los emuladores de un proyecto `demo-`. */
export function checkTarget(env: Record<string, string | undefined>, projectId: string | undefined): { ok: true } | { ok: false; reason: string } {
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if ((env[key] ?? '') === '') return { ok: false, reason: `Falta ${key}: la siembra de demostración solo corre contra los emuladores.` };
  }
  if (projectId === undefined || !projectId.startsWith('demo-')) {
    return { ok: false, reason: `El proyecto «${projectId ?? ''}» no empieza por demo-: la siembra no toca proyectos reales.` };
  }
  return { ok: true };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const STEP_MS = 7 * 60_000;
/** Bogotá va 5 horas detrás de UTC todo el año, sin horario de verano (D-T11 (022)). */
const BOGOTA_OFFSET_MS = 5 * HOUR_MS;
/** Los momentos sembrados caen entre las 8:00 y las 20:00 de Bogotá (RF-5 (022) · 5.1). */
const DAY_OPENS_MS = 8 * HOUR_MS;
const DAY_CLOSES_MS = 20 * HOUR_MS;

/** La medianoche de Bogotá con la que empieza el día en que cae `ms`. */
const bogotaMidnight = (ms: number): number => Math.floor((ms - BOGOTA_OFFSET_MS) / DAY_MS) * DAY_MS + BOGOTA_OFFSET_MS;

/** Vacía Auth y Firestore del emulador (D-T5 (022)). */
async function clearEmulators(projectId: string): Promise<void> {
  const firestore = process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
  const auth = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
  const responses = await Promise.all([
    fetch(`http://${firestore}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://${auth}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' }),
  ]);
  for (const response of responses) if (!response.ok) throw new Error(`No se pudo vaciar el emulador: ${response.status}`);
}

/** Lo que muestra la siembra al terminar, salido de lo que sembró (RF-1 (022) · 1.3, D-T9 (022)). */
export interface DemoSummary {
  accounts: readonly DemoAccount[];
  /** Los ápices por estado: un archivado no cuenta como público ni como privado. */
  apices: { public: number; private: number; archived: number };
  actions: number;
  threads: number;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Las líneas que imprime el comando al terminar la siembra (RF-1 (022) · 1.3). */
export function formatSummary(projectId: string, summary: DemoSummary): string[] {
  const { apices } = summary;
  const total = apices.public + apices.private + apices.archived;
  return [
    '',
    `Datos de demostración en ${projectId}: ${plural(total, 'ápice', 'ápices')} (${plural(apices.public, 'público', 'públicos')}, ${plural(apices.private, 'privado', 'privados')} y ${plural(apices.archived, 'archivado', 'archivados')}), ${plural(summary.actions, 'camino', 'caminos')} y ${plural(summary.threads, 'hilo', 'hilos')}.`,
    `Todas las cuentas entran con la contraseña «${DEMO_PASSWORD}»:`,
    ...summary.accounts.map((person) => `  @${person.username.padEnd(12)} ${person.email.padEnd(26)} ${person.role === 'facilitator' ? 'facilitación' : 'persona inscrita'}`),
    '',
  ];
}

/** Una operación de la siembra fue rechazada (RF-4 (022) · 4.3, D-T8 (022)). */
export class SeedOperationError extends Error {
  readonly operation: string;

  constructor(operation: string, reason: string, cause?: unknown) {
    super(`La siembra se detuvo: la operación ${operation} fue rechazada (${reason}).`, { cause });
    this.name = 'SeedOperationError';
    this.operation = operation;
  }
}

type Accepted<T> = T extends { ok: false } ? never : T;

const reasonOf = (error: unknown): string => {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? `${error.message} [${code}]` : error.message;
  }
  return String(error);
};

/**
 * Espera una operación del servidor y la da por buena solo si fue aceptada: si lanza un error o responde `{ ok: false }`
 * (conflicto de versión, cerradura ocupada…), la siembra se detiene con un error que nombra la operación (RF-4 (022) · 4.3).
 */
export async function runOperation<T>(operation: string, call: Promise<T>): Promise<Accepted<T>> {
  let result: T;
  try {
    result = await call;
  } catch (error) {
    throw new SeedOperationError(operation, reasonOf(error), error);
  }
  if (typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === false) {
    const { ok: _ok, ...rest } = result as Record<string, unknown>;
    throw new SeedOperationError(operation, `respondió ok: false, ${Object.keys(rest).join(', ')}`);
  }
  return result as Accepted<T>;
}

interface ApiceSeed {
  name: string;
  description: string;
  axes: string[];
  status: 'idea' | 'prototipo' | 'en marcha';
  needs?: string;
  offers?: string;
}

/** Los centros de las zonas: cada grupo de ápices cae en una manzana (D-T4 (022)). */
const ZONES = {
  candelaria: zoneOf({ lat: 4.597156, lng: -74.08474 }),
  chapinero: zoneOf({ lat: 4.649886, lng: -74.060244 }),
  suba: zoneOf({ lat: 4.741, lng: -74.084 }),
  kennedy: zoneOf({ lat: 4.628, lng: -74.153 }),
  usme: zoneOf({ lat: 4.472, lng: -74.122 }),
} as const;
type ZoneKey = keyof typeof ZONES;

/** Desplazamientos de menos de 300 m desde el centro de la celda, que mide más de 1 km de lado. */
const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.0015, 0.001],
  [-0.0012, 0.0018],
  [0.002, -0.0015],
  [-0.0018, -0.001],
  [0.0008, -0.0022],
  [-0.0022, 0.0005],
  [0.0012, 0.0024],
  [-0.0005, -0.0025],
];

export async function seedDemo(
  base: DemoCtx,
  options: { projectId: string; today: Date; env?: Record<string, string | undefined> },
): Promise<DemoSummary> {
  // RF-3 (022) · 3.2, D-T10 (022): la comprobación va antes de borrar o escribir, también si otro programa llama a la función.
  const target = checkTarget(options.env ?? process.env, options.projectId);
  if (!target.ok) throw new Error(target.reason);
  await clearEmulators(options.projectId);
  // La sal solo sirve a la solicitud de inscripción (límite por IP); en la siembra es local y de un solo uso (RNF-1 (022)).
  const ctx: DemoCtx = { ...base, clientIp: '127.0.0.1', ipSalt: base.ipSalt ?? `solo-local-${randomBytes(16).toString('hex')}` };

  let clock = options.today.getTime();
  let dayStart = bogotaMidnight(clock);
  /** Fija el día de Bogotá, `daysAgo` días antes del de hoy, a las 8:00. Nunca es hoy, así que nada queda en el futuro (RF-5 (022), D-T11 (022)). */
  const on = (daysAgo: number) => {
    if (daysAgo < 1) throw new Error('La siembra solo ocurre en días anteriores al de hoy.');
    dayStart = bogotaMidnight(options.today.getTime()) - daysAgo * DAY_MS;
    clock = dayStart + DAY_OPENS_MS;
    ctx.setNow(new Date(clock));
  };
  /** Cada operación ocurre unos minutos después de la anterior, sin pasar de las 20:00 del día (RF-5 (022) · 5.1). */
  const later = () => {
    clock += STEP_MS;
    if (clock >= dayStart + DAY_CLOSES_MS) throw new Error('Las operaciones de un día de la siembra no caben antes de las 20:00 de Bogotá: reparte esas operaciones en otro día.');
    ctx.setNow(new Date(clock));
  };

  const [ana, beto, carla, dario, eli] = DEMO_ACCOUNTS.map((a) => a.uid) as [string, string, string, string, string];

  // --- Cuentas (D-T3 (022)): la única escritura directa, con la forma de `register`. ---
  on(21);
  for (const person of DEMO_ACCOUNTS) {
    await ctx.auth.createUser({ uid: person.uid, email: person.email, password: DEMO_PASSWORD, displayName: person.name, emailVerified: true });
    const doc: AccountDoc = { email: person.email, name: person.name, username: person.username, role: person.role, status: 'active' };
    await ctx.db.doc(`usernames/${person.username}`).set({ uid: person.uid });
    await ctx.db.doc(`accounts/${person.uid}`).set(doc);
  }

  // --- Ápices (RF-2 (022) · 2.2) ---
  const used = new Map<ZoneKey, number>();
  const place = (zone: ZoneKey) => {
    const n = used.get(zone) ?? 0;
    used.set(zone, n + 1);
    const [dLat, dLng] = OFFSETS[n % OFFSETS.length]!;
    const center = ZONES[zone];
    return { mode: 'set', lat: Number((center.lat + dLat).toFixed(6)), lng: Number((center.lng + dLng).toFixed(6)) };
  };
  const contents = new Map<string, ApiceSeed>();
  /** El estado de cada ápice sembrado, para el resumen (RF-1 (022) · 1.3). */
  const states = new Map<string, { visibility: 'public' | 'private'; archived: boolean }>();
  let actionCount = 0;
  let threadCount = 0;
  /** Crea el ápice y, salvo que se pida privado, lo publica, como hace su autora. */
  const build = async (uid: string, seed: ApiceSeed, zone: ZoneKey | null, visibility: 'public' | 'private' = 'public'): Promise<string> => {
    later();
    const payload = { needs: '', offers: '', ...seed, ...(zone === null ? {} : { location: place(zone) }) };
    const { id } = await runOperation(`createApice «${seed.name}»`, handleCreateApice(ctx, payload, uid));
    contents.set(id, { needs: '', offers: '', ...seed });
    states.set(id, { visibility: 'private', archived: false });
    if (visibility === 'public') {
      later();
      await runOperation(`setVisibility «${seed.name}»`, handleSetVisibility(ctx, { id, visibility: 'public' }, uid));
      states.set(id, { visibility: 'public', archived: false });
    }
    return id;
  };
  /** Edita el ápice desde su versión vigente y guarda el contenido nuevo. */
  const edit = async (uid: string, id: string, change: Partial<ApiceSeed>): Promise<void> => {
    later();
    const version = (await ctx.db.doc(`apices/${id}`).get()).get('version') as number;
    const content = { ...contents.get(id)!, ...change };
    await runOperation(`editApice «${content.name}»`, handleEditApice(ctx, { id, baseVersion: version, content }, uid));
    contents.set(id, content);
  };

  on(20);
  const huerta = await build(beto, { name: 'Huerta de la Candelaria', description: 'Una huerta en el patio de la junta de acción comunal, abierta los sábados.', axes: ['alimento'], status: 'idea' }, 'candelaria');
  const tanques = await build(ana, { name: 'Tanques de agua lluvia', description: 'Recogemos el agua de los techos de la cuadra en tanques compartidos.', axes: ['agua'], status: 'prototipo', needs: 'Canaletas y alguien que sepa de plomería.', offers: 'Agua para regar las huertas.' }, 'candelaria');
  const mapaAgua = await build(ana, { name: 'Mapa de fuentes de agua', description: 'Un mapa hecho a mano de las fuentes, quebradas y pilas públicas de Chapinero.', axes: ['agua', 'comunicación'], status: 'idea' }, 'chapinero');
  on(19);
  const compostera = await build(beto, { name: 'Compostera comunitaria', description: 'Tres cajones de compost para los residuos de la plaza de mercado.', axes: ['alimento'], status: 'prototipo', offers: 'Abono para las huertas del barrio.' }, 'candelaria');
  const techo = await build(carla, { name: 'Techo verde del colegio', description: 'Plantas nativas sobre el techo del colegio para refrescar los salones.', axes: ['cobijo', 'alimento'], status: 'prototipo', needs: 'Permiso del colegio y sustrato.', offers: 'Talleres de construcción con niñas y niños.' }, 'candelaria');
  const bodega = await build(carla, { name: 'Bodega de herramientas', description: 'Un cuarto con palas, taladros y escaleras que se prestan con un cuaderno.', axes: ['cobijo'], status: 'en marcha', offers: 'Préstamo de herramientas.' }, 'candelaria');
  on(18);
  const paneles = await build(dario, { name: 'Paneles solares de la casa cultural', description: 'Paneles de segunda para que la casa cultural tenga luz en los cortes.', axes: ['energía'], status: 'idea', needs: 'Paneles usados y una persona electricista.' }, 'candelaria');
  const bici = await build(dario, { name: 'Bicicleta generadora', description: 'Una bicicleta fija que carga baterías mientras se pedalea.', axes: ['energía', 'comunicación'], status: 'prototipo' }, 'chapinero');
  const luces = await build(dario, { name: 'Luces solares del sendero', description: 'Lámparas solares en el sendero que va al paradero.', axes: ['energía'], status: 'en marcha', offers: 'Acompañamiento para instalar lámparas.' }, 'kennedy');
  on(17);
  await build(eli, { name: 'Radio comunitaria La Candelaria', description: 'Un programa semanal hecho por vecinas y vecinos, con noticias del barrio.', axes: ['comunicación'], status: 'en marcha', offers: 'Un espacio al aire para anunciar convocatorias.' }, 'candelaria');
  const filtro = await build(ana, { name: 'Filtro de agua para la olla común', description: 'Un filtro de arena y carbón para el agua de la olla comunitaria.', axes: ['agua', 'alimento'], status: 'prototipo', needs: 'Arena lavada y carbón activado.' }, 'candelaria');
  await build(beto, { name: 'Mercado de trueque', description: 'Cambiamos cosecha, ropa y saberes sin dinero, el último domingo del mes.', axes: ['alimento', 'comunicación'], status: 'idea', needs: 'Un lugar cubierto para los domingos.' }, 'candelaria');
  on(16);
  await build(carla, { name: 'Refugio de lluvia en el parque', description: 'Un techo sencillo para esperar a que pase el aguacero.', axes: ['cobijo', 'agua'], status: 'idea', needs: 'Madera y lonas.' }, 'chapinero');
  const humedal = await build(beto, { name: 'Huerta del humedal', description: 'Cultivos en el borde del humedal, con riego por goteo.', axes: ['alimento', 'agua'], status: 'en marcha', offers: 'Plántulas de aromáticas.' }, 'suba');
  await build(dario, { name: 'Biodigestor del barrio', description: 'Gas para cocinar a partir de los residuos orgánicos de la cuadra.', axes: ['energía', 'alimento'], status: 'idea', needs: 'Un tanque grande y planos probados.' }, 'suba');
  on(15);
  const oficios = await build(carla, { name: 'Casa de los oficios', description: 'Una casa donde quien sabe un oficio lo enseña a quien quiere aprenderlo.', axes: ['cobijo', 'comunicación'], status: 'prototipo', offers: 'Clases de carpintería y costura.' }, 'kennedy');
  const semillas = await build(beto, { name: 'Semillas de Usme', description: 'Un banco de semillas criollas que guardan las familias campesinas del sur.', axes: ['alimento'], status: 'prototipo', needs: 'Frascos de vidrio y etiquetas.', offers: 'Semillas de maíz, fríjol y papa criolla.' }, 'usme');
  // Sin ubicación: entran al terreno «Sin ubicación».
  await build(dario, { name: 'Manual de energía compartida', description: 'Un cuadernillo con lo que aprendimos al instalar paneles y baterías.', axes: ['energía', 'comunicación'], status: 'idea' }, null);
  await build(carla, { name: 'Red de cuidados', description: 'Turnos para acompañar a personas mayores y enfermas del barrio.', axes: ['cobijo', 'comunicación'], status: 'idea', needs: 'Más personas para los turnos de la noche.' }, null);
  // Un ápice privado y uno archivado, de Carla.
  await build(carla, { name: 'Boceto de vivienda colectiva', description: 'Primeras ideas para una casa compartida entre cuatro familias.', axes: ['cobijo'], status: 'idea' }, 'kennedy', 'private');
  const feria = await build(carla, { name: 'Feria de cobijas', description: 'Recolectar cobijas para la temporada de frío.', axes: ['cobijo'], status: 'idea' }, 'kennedy');
  on(9);
  later();
  await runOperation('archiveApice «Feria de cobijas»', handleArchiveApice(ctx, { id: feria }, carla));
  states.set(feria, { visibility: 'public', archived: true });

  // --- Historial y avisos (RF-2 (022) · 2.2, 2.6): ediciones propias y ajenas, y una restauración. ---
  on(14);
  await edit(beto, huerta, { status: 'prototipo' });
  await edit(ana, mapaAgua, { status: 'prototipo', description: 'Un mapa hecho a mano de las fuentes, quebradas y pilas públicas de Chapinero, con su estado.' });
  await edit(dario, tanques, { offers: 'Agua para regar las huertas y lavar las herramientas.' });
  await edit(carla, bici, { name: 'Bicicleta que carga celulares' });
  on(12);
  await edit(carla, huerta, { needs: 'Semillas criollas y manos los sábados.' });
  await edit(ana, tanques, { status: 'en marcha' });
  later();
  // La versión vigente se lee, como en `edit()`, y el contenido restaurado se vuelve a leer del ápice (D-T7 (022)).
  const biciVersion = (await ctx.db.doc(`apices/${bici}`).get()).get('version') as number;
  await runOperation('restoreVersion «Bicicleta que carga celulares»', handleRestoreVersion(ctx, { id: bici, n: 1, baseVersion: biciVersion }, dario));
  const restored = (await ctx.db.doc(`apices/${bici}`).get()).data() as ApiceSeed;
  contents.set(bici, { name: restored.name, description: restored.description, axes: restored.axes, status: restored.status, needs: restored.needs ?? '', offers: restored.offers ?? '' });
  on(10);
  later();
  await runOperation('markNoticesSeen (Ana)', handleMarkNoticesSeen(ctx, {}, ana));
  on(6);
  await edit(beto, huerta, { status: 'en marcha', offers: 'Cosecha compartida y abono.' });
  on(2);
  await edit(eli, mapaAgua, { status: 'en marcha', needs: 'Fotos de las pilas públicas que sigan funcionando.' });

  // --- Caminos (RF-2 (022) · 2.3) ---
  const propose = async (uid: string, title: string, description: string, axis: string, apiceIds: string[]): Promise<string> => {
    later();
    const { id } = await runOperation(`proposeCommonAction «${title}»`, handleProposeCommonAction(ctx, { title, description, axis, apiceIds }, uid));
    actionCount += 1;
    return id;
  };
  const join = async (uid: string, actionId: string) => {
    later();
    await runOperation(`joinCommonAction (${actionId})`, handleJoinCommonAction(ctx, { actionId }, uid));
  };
  on(13);
  const lluvia = await propose(ana, 'Agua lluvia para las huertas', 'Llevar el agua de los tanques a las huertas y a la olla común de la Candelaria.', 'agua', [tanques, huerta, filtro]);
  await join(beto, lluvia);
  await join(carla, lluvia);
  on(11);
  const casaCultural = await propose(dario, 'Energía para la casa cultural', 'Juntar paneles, bicicleta y lámparas para que la casa cultural no se quede a oscuras.', 'energía', [paneles, bici, luces]);
  await join(ana, casaCultural);
  await join(eli, casaCultural);
  await join(eli, lluvia);
  on(8);
  const surNorte = await propose(beto, 'Semillas del sur al norte', 'Llevar las semillas criollas de Usme a las huertas de Suba y de la Candelaria.', 'alimento', [semillas, humedal, compostera]);
  await join(carla, surNorte);
  later();
  await runOperation(
    'editCommonAction «Agua lluvia para las huertas»',
    handleEditCommonAction(
      ctx,
      { actionId: lluvia, title: 'Agua lluvia para las huertas', description: 'Llevar el agua de los tanques a las huertas, a la olla común y al mapa de fuentes.', axis: 'agua', apiceIds: [tanques, huerta, filtro, mapaAgua] },
      ana,
    ),
  );
  on(7);
  const feriaHerramientas = await propose(carla, 'Feria de herramientas', 'Una jornada para arreglar y prestar herramientas entre los barrios.', 'cobijo', [bodega, oficios, techo]);
  await join(beto, feriaHerramientas);
  await join(dario, feriaHerramientas);
  on(3);
  later();
  await runOperation('setCommonActionStatus «Feria de herramientas»', handleSetCommonActionStatus(ctx, { actionId: feriaHerramientas, status: 'cerrada' }, carla));

  // --- Plaza (RF-2 (022) · 2.4) ---
  const thread = async (uid: string, axis: string, title: string, text: string): Promise<string> => {
    later();
    const { id } = await runOperation(`openThread «${title}»`, handleOpenThread(ctx, { axis, title, text }, uid));
    threadCount += 1;
    return id;
  };
  const reply = async (uid: string, threadId: string, text: string): Promise<string> => {
    later();
    return (await runOperation(`replyThread (${threadId})`, handleReplyThread(ctx, { threadId, text }, uid))).id;
  };
  on(12);
  const cisterna = await thread(beto, 'agua', '¿Cisterna o tanques plásticos?', 'Queremos guardar agua lluvia para la huerta. ¿Qué les ha funcionado mejor?');
  await reply(ana, cisterna, 'Los tanques plásticos son más fáciles de mover; la cisterna dura más pero pide obra.');
  const carlaReply = await reply(carla, cisterna, 'En el colegio usamos dos tanques unidos por abajo.');
  await reply(dario, cisterna, 'Si los tanques están al sol, píntenlos de oscuro para que no crezcan algas.');
  later();
  await runOperation('editMessage «¿Cisterna o tanques plásticos?»', handleEditMessage(ctx, { threadId: cisterna, messageId: carlaReply, text: 'En el colegio usamos dos tanques unidos por abajo, con una llave de paso.' }, carla));
  on(9);
  const panelesHilo = await thread(dario, 'energía', 'Paneles de segunda: ¿dónde conseguirlos?', 'Busco paneles usados que todavía sirvan, para la casa cultural.');
  await reply(eli, panelesHilo, 'En la radio podemos anunciar que los buscamos.');
  const venta = await reply(beto, panelesHilo, 'Vendo paneles usados, precio a convenir.');
  later();
  await runOperation('archiveMessage «Paneles de segunda»', handleArchiveMessage(ctx, { threadId: panelesHilo, messageId: venta }, ana));
  on(5);
  const horarios = await thread(eli, 'comunicación', 'Horarios de la radio comunitaria', '¿A qué hora les queda mejor escuchar el programa del barrio?');
  await reply(ana, horarios, 'Los sábados en la mañana, antes de ir a la huerta.');
  await reply(carla, horarios, 'Entre semana, después de las siete de la noche.');
  await reply(dario, horarios, 'Si lo graban, lo podemos poner en la bicicleta generadora durante la feria.');
  on(4);
  const trueques = await thread(beto, 'alimento', 'Intercambio de semillas este domingo', 'Llevo maíz y fríjol de Usme. ¿Quién trae aromáticas?');
  await reply(carla, trueques, 'Yo llevo ruda y caléndula.');

  // --- Reglas (RF-2 (022) · 2.5) ---
  on(21);
  const section = async (title: string, text: string): Promise<string> => {
    later();
    return (await runOperation(`saveSection «${title}»`, handleSaveSection(ctx, { title, text }, ana))).id;
  };
  await section('Apoyo mutuo', 'Nos ayudamos sin llevar cuentas: lo que damos y lo que recibimos circula entre todas las personas del barrio.');
  const aguaSection = await section('Cuidado del agua', 'El agua es común. Ningún ápice puede cerrarle el paso a una fuente ni venderla.');
  const decisiones = await section('Decisiones', 'Las decisiones que nos afectan a todas se toman por acuerdo, con tiempo para escuchar las objeciones.');
  later();
  await runOperation('openConstitution', handleOpenConstitution(ctx, {}, ana));
  later();
  await runOperation(
    'saveDocument «Guía para la Plaza»',
    handleSaveDocument(ctx, { title: 'Guía para la Plaza', text: 'La Plaza es para conversar sobre los ápices y los caminos. No se vende ni se compra: se intercambia y se comparte. Quien facilita archiva los mensajes que no siguen esta guía.' }, ana),
  );
  // Una propuesta que ya cerró: se abrió hace 20 días y venció a las 360 h (RF-6 (004)).
  on(20);
  later();
  const vieja = await runOperation(
    'openAmendment «Cuidado del agua»',
    handleOpenAmendment(
      ctx,
      { kind: 'change', sectionId: aguaSection, title: 'Cuidado del agua', text: 'El agua es común. Ningún ápice puede cerrarle el paso a una fuente, venderla ni desperdiciarla.', motive: 'Sumar el cuidado frente al desperdicio.' },
      beto,
    ),
  );
  on(19);
  later();
  await runOperation('agreeAmendment «Cuidado del agua» (Carla)', handleAgreeAmendment(ctx, { amendmentId: vieja.id }, carla));
  later();
  await runOperation('agreeAmendment «Cuidado del agua» (Darío)', handleAgreeAmendment(ctx, { amendmentId: vieja.id }, dario));
  later();
  await runOperation('commentAmendment «Cuidado del agua»', handleCommentAmendment(ctx, { amendmentId: vieja.id, text: 'De acuerdo: el desperdicio también le quita agua a otras personas.' }, ana));
  // Una propuesta abierta, con comentarios, un acuerdo y una objeción.
  on(3);
  later();
  const nueva = await runOperation(
    'openAmendment «Cuidado de quienes facilitan»',
    handleOpenAmendment(
      ctx,
      {
        kind: 'add',
        after: decisiones,
        title: 'Cuidado de quienes facilitan',
        text: 'Quienes facilitan rotan cada seis meses, para que nadie cargue sola con la moderación.',
        motive: 'La facilitación cansa y conviene repartirla.',
      },
      carla,
    ),
  );
  on(2);
  later();
  await runOperation('commentAmendment «Cuidado de quienes facilitan» (Ana)', handleCommentAmendment(ctx, { amendmentId: nueva.id, text: 'Me parece bien. ¿Quién propone la primera rotación?' }, ana));
  later();
  await runOperation('commentAmendment «Cuidado de quienes facilitan» (Beto)', handleCommentAmendment(ctx, { amendmentId: nueva.id, text: 'Seis meses me parece poco; quizá un año.' }, beto));
  later();
  await runOperation('agreeAmendment «Cuidado de quienes facilitan» (Darío)', handleAgreeAmendment(ctx, { amendmentId: nueva.id }, dario));
  on(1);
  later();
  await runOperation('objectAmendment «Cuidado de quienes facilitan»', handleObjectAmendment(ctx, { amendmentId: nueva.id, reason: 'Falta decir cómo se elige a quien entra a facilitar.' }, eli));
  // Refleja el vencimiento de la propuesta vieja, como hace la página al abrir la constitución (RF-12 (004) · 12.5).
  later();
  await runOperation('settleAmendments', handleSettleAmendments(ctx, {}, ana));

  // --- Facilitación (RF-2 (022) · 2.6) ---
  on(1);
  later();
  await runOperation(
    'requestEnrollment «Fer Bici»',
    handleRequestEnrollment(ctx, { email: 'fer_bici@demo.apicca', name: 'Fer Bici', message: 'Quiero sumar un taller de bicicletas en Bosa.', accepted: true }, null),
  );
  later();
  await runOperation('invite «gabi_semillas@demo.apicca»', handleInvite(ctx, { email: 'gabi_semillas@demo.apicca' }, ana));

  ctx.setNow(options.today);
  const seen = [...states.values()];
  return {
    accounts: DEMO_ACCOUNTS,
    apices: {
      public: seen.filter((state) => !state.archived && state.visibility === 'public').length,
      private: seen.filter((state) => !state.archived && state.visibility === 'private').length,
      archived: seen.filter((state) => state.archived).length,
    },
    actions: actionCount,
    threads: threadCount,
  };
}

/** El `Ctx` contra los emuladores, con un reloj movible (D-T2 (022)). */
function emulatorCtx(projectId: string): DemoCtx {
  const app = getApps()[0] ?? initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  let current = new Date();
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    now: () => new Date(current.getTime()),
    random: (bytes) => Uint8Array.from(randomBytes(bytes)),
    setNow: (date) => {
      current = date;
    },
  };
}

async function main(): Promise<void> {
  const projectId = process.env['GCLOUD_PROJECT'] ?? process.env['GCP_PROJECT'];
  const target = checkTarget(process.env, projectId);
  if (!target.ok) throw new Error(target.reason);
  const summary = await seedDemo(emulatorCtx(projectId as string), { projectId: projectId as string, today: new Date() });
  for (const line of formatSummary(projectId as string, summary)) console.log(line);
}

if (typeof require !== 'undefined' && require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
