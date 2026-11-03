// RF-1 (013), RF-4 (018), RNF-2 (013), D-T1 (013), D-T13 (018) · Respaldo diario de Firestore: exporta la base `(default)` completa al
// bucket de respaldo (D-T2 (013)), aparte del de Storage. La retención la pone el ciclo de vida del bucket (D-T3 (013)).
import { v1 } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/** Región de las funciones (D-T2 (001)); no se importa de `index.ts` para no crear un ciclo. */
const REGION = 'us-central1';

/** Lo que usa la exportación del cliente de administración; las pruebas lo sustituyen. */
export interface ExportClient {
  getProjectId(): Promise<string>;
  exportDocuments(request: { name: string; outputUriPrefix: string; collectionIds: string[] }): Promise<[{ promise(): Promise<unknown> }, ...unknown[]]>;
}

/** `gs://{proyecto}-respaldos/firestore/AAAA-MM-DDTHH-mmZ`: una carpeta por ejecución, en UTC. */
export function backupPrefix(projectId: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace(':', '-');
  return `gs://${projectId}-respaldos/firestore/${stamp}Z`;
}

/** Pide la exportación y espera a que la operación termine en la nube (RF-4 (018), D-T13 (018)). */
export async function exportFirestore(client: ExportClient, now: Date): Promise<string> {
  const projectId = await client.getProjectId();
  const outputUriPrefix = backupPrefix(projectId, now);
  try {
    const [operation] = await client.exportDocuments({ name: `projects/${projectId}/databases/(default)`, outputUriPrefix, collectionIds: [] });
    await operation.promise();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Respaldo de Firestore fallido: ${message}`);
  }
  return outputUriPrefix;
}

export const firestoreBackup = onSchedule({ region: REGION, schedule: 'every 24 hours', timeoutSeconds: 540 }, async () => {
  const prefix = await exportFirestore(new v1.FirestoreAdminClient(), new Date());
  console.log(`Exportación de Firestore terminada en ${prefix}`);
});
