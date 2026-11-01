// Carril de emuladores de la app y de las pruebas de navegador: el de siempre o el paralelo (`par`).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- .mjs sin tipos, como scripts/rf-coverage.mjs.
import { ALT_PORTS } from '../../scripts/parallel-emulators.mjs';
import { DEFAULT_EMULATOR_PORTS, PARALLEL_EMULATOR_PORTS, emulatorLane } from './emulatorPorts';

const config = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'));
const scripts: Record<string, string> = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;

describe('emulatorLane', () => {
  it('sin carril o con uno desconocido usa los puertos de firebase.json', () => {
    for (const lane of [undefined, '', 'otro']) expect(emulatorLane(lane).ports).toBe(DEFAULT_EMULATOR_PORTS);
    for (const name of ['auth', 'firestore', 'functions', 'storage'] as const) {
      // Functions no figura en firebase.json: vale su puerto por defecto, 5001.
      expect(DEFAULT_EMULATOR_PORTS[name]).toBe(config.emulators[name]?.port ?? 5001);
    }
    expect(emulatorLane(undefined).outDir).toBe('dist-browser');
  });

  it('el carril `par` usa los puertos de firebase.paralelo.json y su propia carpeta', () => {
    const lane = emulatorLane('par');
    expect(lane.ports).toBe(PARALLEL_EMULATOR_PORTS);
    for (const name of ['auth', 'firestore', 'functions', 'storage'] as const) expect(PARALLEL_EMULATOR_PORTS[name]).toBe(ALT_PORTS[name]);
    expect(PARALLEL_EMULATOR_PORTS.preview).not.toBe(DEFAULT_EMULATOR_PORTS.preview);
    expect(lane.outDir).toBe('dist-browser-par');
  });

  it('`test:browser:par` compila y corre en el carril paralelo, con su config y su temporal', () => {
    const script = scripts['test:browser:par'] ?? '';
    expect(script).toContain('VITE_EMULATOR_LANE=par');
    expect(script).toContain('--outDir dist-browser-par');
    expect(script).toContain('--config firebase.paralelo.json');
    expect(script).toContain('TMPDIR=/tmp/apicca-emu-par');
    expect(scripts['verify:par']).toContain('test:browser:par');
  });
});
