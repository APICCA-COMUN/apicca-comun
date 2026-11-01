// Siembra fija de las pruebas de navegador (D-T13 (002)), como comando de Vitest Browser que corre
// en Node contra los emuladores de `test:browser`. Escribe con las reglas desactivadas y con marcas
// de tiempo explícitas, nunca `serverTimestamp`, para que fechas y capturas no cambien entre corridas.
// `seedPartial` (T-4.13): la autora de usuario largo y el ápice público sin imagen de nombre largo, más la
// constitución común abierta (T-11.2, RNF-4 (004)).
// `seedFull` (T-8.1, RNF-5 (002)): lo anterior más un ápice por condición, la facilitación, una invitación
// pendiente y las cuentas del emulador de Auth.
import { initializeTestEnvironment, type RulesTestContext } from '@firebase/rules-unit-testing';
import { deflateSync } from 'node:zlib';
import { Bytes, Timestamp, doc, setDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import type { BrowserCommand } from 'vitest/node';
import { emulatorLane } from '../../src/data/emulatorPorts';
import { emailKey } from '../../shared/domain/invitations';
import { FIXED_TIME } from './fixed-time';
import {
  APICE_IDS,
  AUTHOR,
  CONSTITUTION_IDS,
  CONSTITUTION_TITLES,
  FACILITATOR,
  INVITED_EMAIL,
  LONG_APICE_ID,
  LONG_AUTHOR_UID,
  LONG_NAME,
  LONG_USERNAME,
  REFERENCE_IDS,
} from './seed-data';

type Firestore = ReturnType<RulesTestContext['firestore']>;

/** El mismo proyecto de `test:browser` y los puertos de su carril (`VITE_EMULATOR_LANE`). */
const PROJECT_ID = 'demo-apicca';
const { ports } = emulatorLane(process.env['VITE_EMULATOR_LANE']);
const FIRESTORE = { host: '127.0.0.1', port: ports.firestore };
const STORAGE = { host: '127.0.0.1', port: ports.storage };
const AUTH_ORIGIN = `http://127.0.0.1:${ports.auth}`;

/** La autora de usuario largo y su ápice público (la siembra parcial). */
async function writePartial(db: Firestore, at: Timestamp): Promise<void> {
  await setDoc(doc(db, `accounts/${LONG_AUTHOR_UID}`), {
    email: `${LONG_USERNAME}@ejemplo.org`,
    name: 'Autora de usuario largo',
    username: LONG_USERNAME,
    role: 'member',
    status: 'active',
  });
  await setDoc(doc(db, `usernames/${LONG_USERNAME}`), { uid: LONG_AUTHOR_UID });
  await writeApice(db, at, {
    id: LONG_APICE_ID,
    content: {
      name: LONG_NAME,
      description: 'Ápice sembrado para las pruebas de navegador.',
      axes: ['agua'],
      needs: '',
      offers: '',
      status: 'idea',
    },
    authorUid: LONG_AUTHOR_UID,
    authorUsername: LONG_USERNAME,
  });
  await writeConstitution(db, at);
}

const HOUR_MS = 3_600_000;

/**
 * La constitución común abierta (T-11.2, RNF-4 (004)): tres secciones, un documento y tres propuestas, con los mismos
 * campos que escriben las ops (plan §5). Todo cuelga de `FIXED_TIME` (D-T18 (004)): las abiertas cierran a las 360 h de
 * abrirse, así que con la hora fija siguen abiertas; la cerrada se cerró antes.
 */
async function writeConstitution(db: Firestore, at: Timestamp): Promise<void> {
  const hoursAgo = (hours: number) => Timestamp.fromMillis(at.toMillis() - hours * HOUR_MS);
  const closesAfter = (openedAt: Timestamp) => Timestamp.fromMillis(openedAt.toMillis() + 360 * HOUR_MS);
  const { sections, document, amendments } = CONSTITUTION_IDS;
  const actor = { uid: AUTHOR.uid, username: AUTHOR.username };
  const openedAt = hoursAgo(24 * 20);
  const changedAt = hoursAgo(24 * 5);
  const batch = writeBatch(db);

  batch.set(doc(db, 'constitution/state'), {
    isOpen: true,
    openedAt,
    order: [sections.water, sections.care, sections.exchange],
    updatedAt: changedAt,
    logSeq: 2,
  });

  const careText = 'Nadie queda sola. Cuidamos de quien lo necesita y pedimos ayuda sin vergüenza.';
  const careNewText = `${careText} También cuidamos el lugar donde nos reunimos.`;
  const initial = [
    [sections.water, CONSTITUTION_TITLES.water, 'El agua es de todas las personas que la cuidan. Se comparte según la necesidad.'],
    [sections.care, 'Cuidado mutuo', careText],
    [sections.exchange, CONSTITUTION_TITLES.exchange, 'Damos y recibimos sin cuenta ni precio. Lo que sobra circula.'],
  ] as const;
  for (const [id, title, text] of initial) {
    const changed = id === sections.care;
    batch.set(doc(db, `constitutionSections/${id}`), {
      title: changed ? CONSTITUTION_TITLES.care : title,
      text: changed ? careNewText : text,
      updatedAt: changed ? changedAt : openedAt,
      isRetired: false,
      retiredAt: null,
    });
    batch.set(doc(db, `constitutionSections/${id}/private/meta`), {
      version: changed ? 2 : 1,
      proposedByUid: changed ? actor.uid : null,
      proposedByUsername: changed ? actor.username : 'texto inicial',
      openAmendment:
        id === sections.water
          ? { id: amendments.openChange, kind: 'change', closesAt: closesAfter(hoursAgo(48)) }
          : null,
    });
    batch.set(doc(db, `constitutionSections/${id}/versions/1`), {
      version: 1,
      title,
      text,
      kind: 'initial',
      amendmentId: null,
      proposedByUid: null,
      proposedByUsername: 'texto inicial',
      agreementsCounted: 0,
      authorAgreementCounted: false,
      objectionsResolved: 0,
      objectionsWithdrawn: 0,
      at: openedAt,
    });
    if (changed) {
      batch.set(doc(db, `constitutionSections/${id}/versions/2`), {
        version: 2,
        title: CONSTITUTION_TITLES.care,
        text: careNewText,
        kind: 'change',
        amendmentId: amendments.closed,
        proposedByUid: actor.uid,
        proposedByUsername: actor.username,
        agreementsCounted: 3,
        authorAgreementCounted: true,
        objectionsResolved: 0,
        objectionsWithdrawn: 0,
        at: changedAt,
      });
    }
  }

  batch.set(doc(db, 'constitutionLog/1'), {
    seq: 1,
    kind: 'opened',
    sectionId: null,
    sectionTitle: null,
    version: null,
    amendmentId: null,
    byUid: FACILITATOR.uid,
    byUsername: FACILITATOR.username,
    at: openedAt,
  });
  batch.set(doc(db, 'constitutionLog/2'), {
    seq: 2,
    kind: 'changed',
    sectionId: sections.care,
    sectionTitle: CONSTITUTION_TITLES.care,
    version: 2,
    amendmentId: amendments.closed,
    byUid: actor.uid,
    byUsername: actor.username,
    at: changedAt,
    agreementsCounted: 3,
    authorAgreementCounted: true,
    objectionsResolved: 0,
    objectionsWithdrawn: 0,
  });

  const documentText = 'Cómo acompañarnos cuando alguien lo necesita.\n\n- Escuchar primero.\n- Ofrecer lo que se tiene.';
  batch.set(doc(db, `constitutionDocuments/${document}`), {
    title: CONSTITUTION_TITLES.document,
    text: documentText,
    updatedAt: hoursAgo(24 * 10),
    createdAt: hoursAgo(24 * 10),
    version: 1,
    isArchived: false,
  });
  batch.set(doc(db, `constitutionDocuments/${document}/versions/1`), {
    title: CONSTITUTION_TITLES.document,
    text: documentText,
    version: 1,
    byUid: FACILITATOR.uid,
    byUsername: FACILITATOR.username,
    at: hoursAgo(24 * 10),
  });

  const amendment = (fields: Record<string, unknown>) => ({
    revisionNo: 1,
    baseSectionVersion: 1,
    authorUid: actor.uid,
    authorUsername: actor.username,
    extended: false,
    isOpen: true,
    result: null,
    reasons: [],
    closedAt: null,
    agreementsCounted: 0,
    objectionsResolved: 0,
    objectionsWithdrawn: 0,
    newSectionId: null,
    eventSeq: 1,
    ...fields,
  });
  const changeOpenedAt = hoursAgo(48);
  const addOpenedAt = hoursAgo(24);
  batch.set(
    doc(db, `amendments/${amendments.openChange}`),
    amendment({
      kind: 'change',
      sectionId: sections.water,
      after: null,
      slotKey: `s:${sections.water}`,
      title: CONSTITUTION_TITLES.openChange,
      text: 'El agua es de todas las personas que la cuidan. Se comparte según la necesidad y por turnos acordados.',
      motive: 'En la sequía hacen falta turnos claros.',
      openedAt: changeOpenedAt,
      closesAt: closesAfter(changeOpenedAt),
    }),
  );
  batch.set(
    doc(db, `amendments/${amendments.openAdd}`),
    amendment({
      kind: 'add',
      sectionId: null,
      after: sections.exchange,
      slotKey: `a:${sections.exchange}`,
      baseSectionVersion: null,
      title: CONSTITUTION_TITLES.openAdd,
      text: 'Guardamos la memoria de cada cosecha para quien venga después.',
      motive: 'Lo aprendido no debería perderse.',
      openedAt: addOpenedAt,
      closesAt: closesAfter(addOpenedAt),
    }),
  );
  batch.set(
    doc(db, `amendments/${amendments.closed}`),
    amendment({
      kind: 'change',
      sectionId: sections.care,
      after: null,
      slotKey: `s:${sections.care}`,
      title: CONSTITUTION_TITLES.care,
      text: careNewText,
      motive: 'El lugar también necesita cuidado.',
      isOpen: false,
      result: 'approved',
      openedAt,
      closesAt: changedAt,
      closedAt: changedAt,
      agreementsCounted: 3,
    }),
  );
  // El acuerdo implícito de quien propone y un comentario en la propuesta abierta de cambio.
  batch.set(doc(db, `amendments/${amendments.openChange}/stances/${actor.uid}`), {
    username: actor.username,
    agreement: 'active',
    agreedAtRevision: 1,
    agreedAt: changeOpenedAt,
    openObjectionId: null,
    withdrawnReason: null,
  });
  batch.set(doc(db, `amendments/${amendments.openChange}/comments/comentario-fijo`), {
    text: 'Me parece bien, ¿quién propone los turnos?',
    authorUid: FACILITATOR.uid,
    authorUsername: FACILITATOR.username,
    createdAt: hoursAgo(30),
    editedAt: null,
    version: 1,
    archived: false,
    archivedBy: null,
    archivedByUsername: null,
    archivedAt: null,
  });
  await batch.commit();
}

interface SeedApice {
  id: string;
  content: { name: string; description: string; axes: string[]; needs: string; offers: string; status: string };
  authorUid: string;
  authorUsername: string;
  visibility?: 'public' | 'private';
  archived?: boolean;
  image?: { id: string; altText: string; png: Uint8Array } | null;
  activeReferenceCount?: number;
}

/** Los mismos campos que `createApiceDoc` (functions/src/apiceStore.ts) más lo que cambian las demás ops. */
async function writeApice(db: Firestore, at: Timestamp, apice: SeedApice): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, `apices/${apice.id}`), {
    ...apice.content,
    visibility: apice.visibility ?? 'public',
    isArchived: apice.archived === true,
    // Como `archiveApice`: quién y cuándo.
    archive: apice.archived === true ? { byUsername: apice.authorUsername, at } : null,
    authorUid: apice.authorUid,
    authorUsername: apice.authorUsername,
    createdAt: at,
    updatedAt: at,
    lastEditedByUsername: apice.authorUsername,
    version: 1,
    location: null,
    hasLocation: false,
    // Como `acceptProposal`: el PNG vive en el propio documento (D-T6 (001)).
    image: apice.image === undefined || apice.image === null ? null : { ...apice.image, png: Bytes.fromUint8Array(apice.image.png) },
    activeReferenceCount: apice.activeReferenceCount ?? 0,
  });
  batch.set(doc(db, `apices/${apice.id}/versions/1`), {
    n: 1,
    content: apice.content,
    location: null,
    kind: 'create',
    restoredFromN: null,
    savedByUid: apice.authorUid,
    savedByUsername: apice.authorUsername,
    savedAt: at,
  });
  await batch.commit();
}

export const seedPartial: BrowserCommand<[], void> = async () => {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE });
  try {
    await env.clearFirestore();
    const at = Timestamp.fromDate(new Date(FIXED_TIME));
    await env.withSecurityRulesDisabled(async (context) => {
      await writePartial(context.firestore(), at);
    });
  } finally {
    await env.cleanup();
  }
};

// --- Siembra completa -------------------------------------------------------------------------------

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

/** PNG RGB de 64 × 64 fijo: un tablero de 8 × 8 píxeles de dos tonos, sin azar ni fecha (bytes iguales en cada corrida). */
export function fixedPng(): Uint8Array {
  const size = 64;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      row.set(light ? [0xe8, 0xc9, 0x6a] : [0x3d, 0x7a, 0x5c], 1 + x * 3);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Las cuentas del emulador de Auth con uid y contraseña fijos; antes se borran las que haya. */
async function seedAuth(): Promise<void> {
  const base = `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1`;
  const cleared = await fetch(`${AUTH_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  if (!cleared.ok) throw new Error(`No se pudo limpiar Auth: ${cleared.status}`);
  for (const account of [AUTHOR, FACILITATOR]) {
    const response = await fetch(`${base}/projects/${PROJECT_ID}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: account.uid, email: account.email, password: account.password, emailVerified: true }),
    });
    if (!response.ok) throw new Error(`No se pudo crear ${account.email} en Auth: ${await response.text()}`);
  }
}

export const seedFull: BrowserCommand<[], void> = async () => {
  await seedAuth();
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE, storage: STORAGE });
  try {
    await env.clearFirestore();
    await env.clearStorage();
    const at = Timestamp.fromDate(new Date(FIXED_TIME));
    const png = fixedPng();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await writePartial(db, at);
      // Las cuentas: los mismos campos que `register` (functions/src/ops/register.ts).
      for (const [account, role] of [[AUTHOR, 'member'], [FACILITATOR, 'facilitator']] as const) {
        await setDoc(doc(db, `accounts/${account.uid}`), {
          email: account.email,
          name: account.name,
          username: account.username,
          role,
          status: 'active',
        });
        await setDoc(doc(db, `usernames/${account.username}`), { uid: account.uid });
      }
      // Una invitación pendiente (functions/src/ops/invite.ts). Vence en 2099 para que no pase a «Vencida»
      // con el reloj real y las capturas no cambien.
      await setDoc(doc(db, `invitations/${await emailKey(INVITED_EMAIL)}`), {
        email: INVITED_EMAIL,
        token: 'invitacion-fija',
        status: 'pending',
        issuedAt: at,
        expiresAt: Timestamp.fromDate(new Date('2099-01-01T00:00:00Z')),
        createdBy: FACILITATOR.uid,
      });

      const author = { authorUid: AUTHOR.uid, authorUsername: AUTHOR.username };
      const content = (name: string, status: string, axes: string[]) => ({
        name,
        description: `${name}: ápice sembrado para las pruebas de navegador.`,
        axes,
        needs: 'Manos para cavar y tiempo compartido.',
        offers: 'Herramientas y un lugar donde reunirse.',
        status,
      });
      const referenceDoc = (path: string, altText: string, extra: Record<string, unknown>) => ({
        path,
        altText,
        contentType: 'image/png',
        bytes: png.length,
        width: 64,
        height: 64,
        uploadedByUid: AUTHOR.uid,
        uploadedByUsername: AUTHOR.username,
        uploadedAt: at,
        isRemoved: false,
        removal: null,
        ...extra,
      });

      // Público con imagen (en el documento, como `acceptProposal`) y una referencia activa (también en Storage).
      const activePath = `apices/${APICE_IDS.withImage}/references/${REFERENCE_IDS.active}`;
      await writeApice(db, at, {
        id: APICE_IDS.withImage,
        content: content('Huerta con imagen', 'prototipo', ['alimento']),
        ...author,
        image: { id: 'imagen-fija', altText: 'Tablero de dos tonos, verde y ámbar', png },
        activeReferenceCount: 1,
      });
      await setDoc(doc(db, activePath), referenceDoc(activePath, 'Tablero de referencia', {}));
      await uploadBytes(ref(context.storage(), activePath), png, { contentType: 'image/png' });

      await writeApice(db, at, {
        id: APICE_IDS.allAxes,
        content: content('Los cinco ejes', 'en marcha', ['agua', 'alimento', 'cobijo', 'energía', 'comunicación']),
        ...author,
      });
      await writeApice(db, at, { id: APICE_IDS.private, content: content('Ápice privado', 'idea', ['cobijo']), ...author, visibility: 'private' });
      await writeApice(db, at, { id: APICE_IDS.archived, content: content('Ápice archivado', 'idea', ['energía']), ...author, archived: true });

      // Propuesta pendiente de la autora (functions/src/ops/generateImage.ts); vence en 2099 por la misma razón.
      await writeApice(db, at, { id: APICE_IDS.withProposal, content: content('Ápice con propuesta', 'idea', ['comunicación']), ...author });
      await setDoc(doc(db, `proposals/${APICE_IDS.withProposal}_${AUTHOR.uid}`), {
        apiceId: APICE_IDS.withProposal,
        requestedByUid: AUTHOR.uid,
        png: Bytes.fromUint8Array(png),
        referenceIds: [],
        baseVersion: 1,
        baseImageId: null,
        createdAt: at,
        expiresAt: Timestamp.fromDate(new Date('2099-01-01T00:00:00Z')),
      });

      // Referencia retirada por la facilitación (functions/src/ops/referenceRemoval.ts): el contador ya no la cuenta.
      const retractedPath = `apices/${APICE_IDS.withRetractedReference}/references/${REFERENCE_IDS.retracted}`;
      await writeApice(db, at, { id: APICE_IDS.withRetractedReference, content: content('Referencia retirada', 'idea', ['agua']), ...author });
      await setDoc(
        doc(db, retractedPath),
        referenceDoc(retractedPath, 'Imagen retirada', {
          isRemoved: true,
          removal: { kind: 'retracted', byUsername: FACILITATOR.username, at, reason: 'No corresponde al ápice.' },
        }),
      );
      await uploadBytes(ref(context.storage(), retractedPath), png, { contentType: 'image/png' });
    });
  } finally {
    await env.cleanup();
  }
};

declare module 'vitest/browser' {
  interface BrowserCommands {
    seedPartial: () => Promise<void>;
    seedFull: () => Promise<void>;
  }
}
