// RF-5 (021) · 5.4, RF-5 (021) · 5.5, D-T15 (021) · Calcula de una vez la zona H3 de los ápices que ya tenían ubicación,
// desde el punto guardado de su versión vigente, sin pedirle nada a sus autoras. Solo escribe `apices/{id}.location`: no
// crea versión, no cambia `updatedAt` ni toca las versiones anteriores, que conservan la ubicación que mostraban. Un
// ápice con ubicación y sin punto guardado se informa y se deja como está. Se puede repetir: lo ya calculado no cambia.
//
// Uso (desde functions/), con credenciales de aplicación; sin --apply solo cuenta:
//   npm run recalculate-zones -- --project apicca-com            (ensayo)
//   npm run recalculate-zones -- --project apicca-com --apply    (escribe)
import { isDeepStrictEqual } from 'node:util';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { validateCoordinates, type Precision } from '../../shared/domain/location';
import { publishedLocation } from '../src/zone';

export interface ZoneReport {
  /** Ápices con ubicación. */
  located: number;
  /** Ápices cuya ubicación publicada cambia (o cambiaría, en el ensayo). */
  changed: number;
  /** Ápices que ya tenían su zona. */
  unchanged: number;
  /** Ids de los ápices con ubicación y sin punto guardado: no se tocan. */
  missing: string[];
}

export async function recalculateZones(deps: { db: Firestore }, options: { dryRun: boolean }): Promise<ZoneReport> {
  const { db } = deps;
  const report: ZoneReport = { located: 0, changed: 0, unchanged: 0, missing: [] };
  const apices = await db.collection('apices').where('hasLocation', '==', true).get();
  for (const doc of apices.docs) {
    report.located += 1;
    const current = doc.get('location') as { precision?: unknown } | null | undefined;
    const precision: Precision = current?.precision === 'exact' ? 'exact' : 'approximate';
    const stored = await db.doc(`apices/${doc.id}/versions/${String(doc.get('version'))}/private/exact`).get();
    const point = validateCoordinates(stored.get('lat'), stored.get('lng'));
    if (!point.ok) {
      report.missing.push(doc.id);
      continue;
    }
    const location = publishedLocation(point.value, precision);
    if (isDeepStrictEqual(current, location)) {
      report.unchanged += 1;
      continue;
    }
    report.changed += 1;
    // Con la condición de `updateTime`, si alguien guardó el ápice mientras tanto, esta escritura falla en vez de pisarlo:
    // ese guardado ya calculó su zona (RF-5 (021) · 5.1).
    if (!options.dryRun) await doc.ref.update({ location }, { lastUpdateTime: doc.updateTime });
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
  const report = await recalculateZones({ db: getFirestore(app, databaseId) }, { dryRun: !apply });
  console.log(`${apply ? 'Recálculo' : 'Ensayo del recálculo'} de zonas en ${databaseId}: ${JSON.stringify(report, null, 2)}`);
  if (report.missing.length > 0) process.exit(1);
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
