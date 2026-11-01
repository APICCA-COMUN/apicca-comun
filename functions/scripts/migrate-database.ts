// RF-4 (006), RF-5 (006), RNF-1 (006), D-T2 (006) · Copia de una vez los documentos de una base de Firestore a otra
// (de `apicca` a `(default)`), con sus subcolecciones, ids y valores. No borra ni modifica nada del origen, y no toca lo
// que el destino ya tenga fuera de las rutas que copia. Si en el destino hay un documento distinto en una ruta que se
// copiaría, se detiene sin escribir y lo lista. Al terminar, vuelve a leer el destino y lista lo que falte o difiera.
//
// Uso (desde functions/), con credenciales de aplicación; sin --apply solo cuenta:
//   npm run migrate-database -- --project apicca-com            (ensayo)
//   npm run migrate-database -- --project apicca-com --apply    (copia)
import { isDeepStrictEqual } from 'node:util';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentData, type Firestore } from 'firebase-admin/firestore';

export interface MigrationReport {
  /** Documentos que existen en el origen. */
  documents: number;
  copied: number;
  /** Ya idénticos en el destino. */
  skipped: number;
  /** Rutas con un documento distinto en el destino; si hay alguna, no se escribe nada. */
  conflicts: string[];
  /** Rutas que, tras copiar, faltan o difieren en el destino. */
  missing: string[];
}

interface Entry {
  path: string;
  data: DocumentData;
}

async function readAll(db: Firestore): Promise<Entry[]> {
  const entries: Entry[] = [];
  const visit = async (collections: FirebaseFirestore.CollectionReference[]): Promise<void> => {
    for (const collection of collections) {
      for (const ref of await collection.listDocuments()) {
        const snap = await ref.get();
        if (snap.exists) entries.push({ path: ref.path, data: snap.data() as DocumentData });
        await visit(await ref.listCollections());
      }
    }
  };
  await visit(await db.listCollections());
  return entries;
}

export async function migrateDatabase(
  dbs: { source: Firestore; target: Firestore },
  options: { dryRun: boolean },
): Promise<MigrationReport> {
  const { source, target } = dbs;
  const entries = await readAll(source);
  const report: MigrationReport = { documents: entries.length, copied: 0, skipped: 0, conflicts: [], missing: [] };

  const pending: Entry[] = [];
  for (const entry of entries) {
    const existing = await target.doc(entry.path).get();
    if (!existing.exists) pending.push(entry);
    else if (isDeepStrictEqual(existing.data(), entry.data)) report.skipped++;
    else report.conflicts.push(entry.path);
  }
  if (report.conflicts.length > 0 || options.dryRun) return report;

  const writer = target.bulkWriter();
  for (const entry of pending) void writer.set(target.doc(entry.path), entry.data);
  await writer.close();
  report.copied = pending.length;

  for (const entry of entries) {
    const written = await target.doc(entry.path).get();
    if (!written.exists || !isDeepStrictEqual(written.data(), entry.data)) report.missing.push(entry.path);
  }
  return report;
}

function option(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

async function main(args: string[]): Promise<void> {
  const projectId = option(args, '--project');
  const from = option(args, '--from') ?? 'apicca';
  const to = option(args, '--to') ?? '(default)';
  const apply = args.includes('--apply');
  const app = getApps()[0] ?? initializeApp(projectId ? { projectId } : {});
  const report = await migrateDatabase(
    { source: getFirestore(app, from), target: getFirestore(app, to) },
    { dryRun: !apply },
  );
  console.log(`${apply ? 'Copia' : 'Ensayo'} de ${from} a ${to}: ${JSON.stringify(report, null, 2)}`);
  if (report.conflicts.length > 0 || report.missing.length > 0) process.exit(1);
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
