// Genera `firestore.indexes.json` desde `shared/domain/indexes.ts` (T-3.8, D-T17 (001)).
// Carga el módulo TypeScript con Vite, que ya es dependencia, sin agregar otra.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { requiredIndexes, serializeIndexes } = await server.ssrLoadModule('/shared/domain/indexes.ts');
  const indexes = requiredIndexes();
  writeFileSync(resolve(root, 'firestore.indexes.json'), serializeIndexes(indexes));
  console.log(`gen-indexes: ${indexes.length} índices escritos en firestore.indexes.json.`);
} finally {
  await server.close();
}
