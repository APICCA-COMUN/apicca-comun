// Servidor de vista previa del build de pruebas (D-T13 (002)). `test:browser` compila antes
// `dist-browser/`; aquí solo se sirve en un puerto fijo para que el comando de `commands.ts`
// abra páginas aparte contra el `index.html` real, y se cierra al terminar.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { emulatorLane } from '../../src/data/emulatorPorts';

const lane = emulatorLane(process.env['VITE_EMULATOR_LANE']);
export const PREVIEW_PORT = lane.ports.preview;
export const PREVIEW_ORIGIN = `http://localhost:${PREVIEW_PORT}`;

const root = resolve(import.meta.dirname, '..', '..');

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`El servidor de vista previa no respondió en ${url}.`);
}

export default async function setup(): Promise<() => Promise<void>> {
  if (!existsSync(resolve(root, lane.outDir, 'index.html'))) {
    throw new Error(`Falta ${lane.outDir}/. Corre las pruebas de navegador con \`npm run test:browser\` (o \`test:browser:par\`), que lo compila.`);
  }
  const server: ChildProcess = spawn(
    process.execPath,
    [resolve(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--outDir', lane.outDir, '--port', String(PREVIEW_PORT), '--strictPort'],
    { cwd: root, stdio: 'ignore' },
  );
  await waitForServer(PREVIEW_ORIGIN, 15_000);
  return async () => {
    server.kill();
  };
}
