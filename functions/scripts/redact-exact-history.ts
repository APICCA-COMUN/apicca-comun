// RF-2 (016) · 2.2 · Limpia de una vez el historial de los ápices que dejaron de mostrar su ubicación exacta antes de `5b05b09`
// (25-11-2026). Hasta ese commit, bajar la precisión a aproximada (o fijar una aproximada nueva) no tocaba las versiones
// anteriores: `apices/{id}/versions/{n}.location` seguía publicando lat/lng exactos a quien puede leer el historial. Desde
// entonces lo hace `saveVersion` (`src/apiceStore.ts`); este script aplica la misma regla a lo ya guardado:
// - Ápice hoy aproximado: cada versión exacta se redacta a la forma aproximada de su zona; su `private/exact` se conserva
//   (solo lo leen la autora y Facilitación). Una versión exacta sin zona (anterior a la spec 021) no tiene forma aproximada:
//   queda `location: null, locationPurged: true` y se borra su `private/exact`, como hace `saveVersion`.
// - Ápice hoy sin ubicación: cada versión exacta se purga (`location: null, locationPurged: true`) y se borra su
//   `private/exact`, como al quitar la ubicación.
// - Ápice hoy exacto: no se toca (su historial puede mostrar el punto, igual que el ápice).
// No crea versión ni cambia `updatedAt`. Cada ápice va en su propia transacción: si alguien lo guarda a la vez, se reintenta
// con lo nuevo. Recorre ápice por ápice (sin `collectionGroup`), así que no necesita índice. Se puede repetir: lo ya
// limpio no cambia.
//
// Uso (desde functions/), con credenciales de aplicación; sin --apply solo cuenta:
//   npm run redact-exact-history -- --project apicca-com            (ensayo)
//   npm run redact-exact-history -- --project apicca-com --apply    (escribe)
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Location } from '../../shared/domain/location';

export interface RedactReport {
  /** Ápices revisados. */
  scanned: number;
  /** Ápices con versiones que cambian (o cambiarían, en el ensayo). */
  affected: string[];
  /** Versiones redactadas a su zona. */
  redacted: number;
  /** Versiones purgadas (sin zona, o el ápice ya no tiene ubicación), con su punto exacto borrado. */
  purged: number;
}

const EXACT_PATH = (id: string, n: number) => `apices/${id}/versions/${n}/private/exact`;

export async function redactExactHistory(deps: { db: Firestore }, options: { dryRun: boolean }): Promise<RedactReport> {
  const { db } = deps;
  const report: RedactReport = { scanned: 0, affected: [], redacted: 0, purged: 0 };
  const apices = await db.collection('apices').select('location').get();
  for (const { ref, id } of apices.docs) {
    report.scanned += 1;
    const result = await db.runTransaction(async (tx) => {
      // Lecturas antes de cualquier escritura.
      const apice = await tx.get(ref);
      const current = (apice.get('location') as Location | null | undefined) ?? null;
      if (current?.precision === 'exact') return { redacted: 0, purged: 0 };
      const exact = (await tx.get(ref.collection('versions').where('location.precision', '==', 'exact'))).docs;
      let redacted = 0;
      let purged = 0;
      for (const doc of exact) {
        const old = doc.get('location') as Location;
        if (current !== null && old.zone !== undefined) {
          redacted += 1;
          if (!options.dryRun) tx.update(doc.ref, { location: { lat: old.zone.lat, lng: old.zone.lng, precision: 'approximate', zone: old.zone } });
        } else {
          purged += 1;
          if (!options.dryRun) {
            tx.delete(db.doc(EXACT_PATH(id, doc.get('n') as number)));
            tx.update(doc.ref, { location: null, locationPurged: true });
          }
        }
      }
      return { redacted, purged };
    });
    if (result.redacted + result.purged > 0) {
      report.affected.push(id);
      report.redacted += result.redacted;
      report.purged += result.purged;
    }
  }
  return report;
}

function option(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

async function main(args: string[]): Promise<void> {
  const projectId = option(args, '--project');
  const databaseId = option(args, '--database') ?? '(default)';
  const apply = args.includes('--apply');
  const app = getApps()[0] ?? initializeApp(projectId ? { projectId } : {});
  const report = await redactExactHistory({ db: getFirestore(app, databaseId) }, { dryRun: !apply });
  console.log(`${apply ? 'Limpieza' : 'Ensayo de la limpieza'} del historial exacto en ${databaseId}: ${JSON.stringify(report, null, 2)}`);
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
