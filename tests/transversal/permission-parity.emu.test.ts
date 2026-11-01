// T-7.2 · Paridad de permisos (RNF-5 (001), D-T18 (001)): la tabla única `APICE_ACCESS_TABLE` se ejecuta
// contra el dominio (`access.ts`), contra las reglas de Firestore y contra las ops del servidor.
// Si un caso cambia solo en un lugar, esta prueba falla.
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APICE_ACCESS_TABLE,
  APICE_ACTORS,
  APICE_STATES,
  apiceFor,
  canArchive,
  canChangeVisibility,
  canEdit,
  canSeeHistory,
  canView,
  type ApiceActorName,
  type ApiceStateName,
} from '../../shared/domain/access';
import { ApiError } from '../../functions/src/errors';
import { handleArchiveApice } from '../../functions/src/ops/archiveApice';
import { handleCreateApice } from '../../functions/src/ops/createApice';
import { handleEditApice } from '../../functions/src/ops/editApice';
import { handleRestoreApice } from '../../functions/src/ops/restoreApice';
import { handleSetVisibility } from '../../functions/src/ops/setVisibility';
import { clearEmulators, createTestCtx, seedAccount, type TestCtx } from '../../functions/src/testing';
import { VALID } from '../../functions/src/testing/apiceKit';
import { createTestEnvironment } from '../rules/setup';

let env: RulesTestEnvironment;
let ctx: TestCtx;
/** Dos ápices por fila: uno solo para leer (reglas) y otro que las ops pueden mutar. */
const ids = new Map<string, { read: string; ops: string }>();

const key = (actor: ApiceActorName, state: ApiceStateName) => `${actor}|${state}`;
const ACTORS = Object.keys(APICE_ACTORS) as ApiceActorName[];
const STATES = Object.keys(APICE_STATES) as ApiceStateName[];

const dbOf = (actor: ApiceActorName) =>
  actor === 'visitor' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(actor).firestore();

/** Resuelve `true` si la op termina y `false` si el servidor la rechaza con un `ApiError`. */
async function allowed(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return true;
  } catch (error) {
    if (error instanceof ApiError) return false;
    throw error;
  }
}

beforeAll(async () => {
  // `PARITY_RULES_FILE` carga otras reglas: así se comprueba que un cambio solo en las reglas hace fallar esta prueba.
  const rulesFile = process.env['PARITY_RULES_FILE'];
  env = await createTestEnvironment(rulesFile === undefined ? {} : { rules: readFileSync(rulesFile, 'utf8') });
  await clearEmulators();
  ctx = createTestCtx({ now: new Date('2026-09-01T15:00:00Z') });
  const seeder = (await seedAccount(ctx, { username: 'seeder' })).uid;
  for (const actor of ACTORS) {
    const { viewer } = APICE_ACTORS[actor];
    if (viewer === null) continue;
    // El uid de la cuenta es el nombre del actor: las ops y las reglas leen `accounts/{uid}`.
    await ctx.db.doc(`accounts/${actor}`).set({
      email: `${actor}@ejemplo.org`,
      name: actor,
      username: actor.toLowerCase(),
      role: viewer.role,
      status: viewer.status,
    });
  }
  for (const actor of ACTORS) {
    for (const state of STATES) {
      const made: string[] = [];
      for (let copy = 0; copy < 2; copy += 1) {
        // La cuenta sembradora crea más ápices que la cuota diaria (RF-7 (016) · 7.1): se libera su cupo antes de cada uno.
        await ctx.db.doc(`rateLimits/daily-apice-${seeder}`).delete();
        const { id } = await handleCreateApice(ctx, VALID, seeder);
        const access = apiceFor(state, actor);
        await ctx.db.doc(`apices/${id}`).update({
          authorUid: access.authorUid,
          visibility: access.visibility,
          isArchived: access.isArchived,
        });
        await ctx.db.doc(`apices/${id}/events/e1`).set({ type: 'visibility' });
        made.push(id);
      }
      ids.set(key(actor, state), { read: made[0] as string, ops: made[1] as string });
    }
  }
}, 120_000);

afterAll(async () => {
  await env.cleanup();
});

describe('paridad de permisos · una tabla, tres ejecutores', () => {
  for (const row of APICE_ACCESS_TABLE) {
    const label = `${row.actor} · ${row.state}`;

    it(`RNF-5 (001): ${label} → el dominio coincide con la tabla`, () => {
      const { viewer } = APICE_ACTORS[row.actor];
      const apice = apiceFor(row.state, row.actor);
      expect({
        view: canView(viewer, apice),
        edit: canEdit(viewer, apice),
        history: canSeeHistory(viewer, apice),
        visibility: canChangeVisibility(viewer, apice),
        archive: canArchive(viewer, apice),
      }).toEqual({ view: row.view, edit: row.edit, history: row.history, visibility: row.visibility, archive: row.archive });
    });

    it(`RNF-5 (001): ${label} → las reglas leen ápice, versiones y eventos como dice la tabla`, async () => {
      const id = ids.get(key(row.actor, row.state))?.read as string;
      const view = getDoc(doc(dbOf(row.actor), `apices/${id}`));
      await (row.view ? assertSucceeds(view) : assertFails(view));
      for (const path of [`apices/${id}/versions/1`, `apices/${id}/events/e1`]) {
        const read = getDoc(doc(dbOf(row.actor), path));
        await (row.history ? assertSucceeds(read) : assertFails(read));
      }
    });

    it(`RNF-5 (001): ${label} → las ops editan, cambian visibilidad y archivan como dice la tabla`, async () => {
      const id = ids.get(key(row.actor, row.state))?.ops as string;
      const uid = APICE_ACTORS[row.actor].viewer?.uid ?? null;
      const state = APICE_STATES[row.state];

      const edit = handleEditApice(
        ctx,
        { id, baseVersion: 1, content: { ...VALID, status: 'idea', name: 'Cambio de prueba' } },
        uid,
      );
      expect(await allowed(edit), `editar · ${label}`).toBe(row.edit);
      const version = (await ctx.db.doc(`apices/${id}`).get()).get('version') as number;
      expect(version).toBe(row.edit ? 2 : 1);

      // Pedir la visibilidad que ya tiene no cambia nada, pero sí pasa por el permiso.
      const visibility = handleSetVisibility(ctx, { id, visibility: state.visibility }, uid);
      expect(await allowed(visibility), `visibilidad · ${label}`).toBe(row.visibility);

      // «Archivar o restaurar» es una sola columna: se archiva lo no archivado y se restaura lo archivado.
      const archive = state.isArchived
        ? handleRestoreApice(ctx, { id }, uid)
        : handleArchiveApice(ctx, { id }, uid);
      expect(await allowed(archive), `archivar o restaurar · ${label}`).toBe(row.archive);
      const after = (await ctx.db.doc(`apices/${id}`).get()).get('isArchived') as boolean;
      expect(after).toBe(row.archive ? !state.isArchived : state.isArchived);
    });
  }
});
