// Arnés de pruebas de reglas de Firestore. Corre solo dentro de
// `firebase emulators:exec --project demo-apicca` (script `test:emu`); el emulador
// escucha en los puertos fijos de firebase.json.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

/** Proyecto de prueba: el prefijo `demo-` garantiza que nada sale del emulador. */
export const PROJECT_ID = 'demo-apicca';

const rulesPath = resolve(import.meta.dirname, '../../firestore.rules');

/** Reglas reales del sitio, las que se despliegan. */
export function readSiteRules(): string {
  return readFileSync(rulesPath, 'utf8');
}

interface TestEnvironmentOptions {
  /** Reglas a cargar; por defecto, firestore.rules. Una sonda puede traer las suyas. */
  rules?: string;
  /** Proyecto del emulador; una sonda con reglas propias usa uno distinto para no pisar las reales. */
  projectId?: string;
}

export async function createTestEnvironment(
  options: TestEnvironmentOptions = {},
): Promise<RulesTestEnvironment> {
  const host = process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
  const [hostname, port] = host.split(':');
  return initializeTestEnvironment({
    projectId: options.projectId ?? PROJECT_ID,
    firestore: {
      host: hostname ?? '127.0.0.1',
      port: Number(port ?? 8080),
      rules: options.rules ?? readSiteRules(),
    },
  });
}
