import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- .mjs sin tipos, como scripts/rf-coverage.mjs.
import { ALT_PORTS, ALT_TMPDIR, DEFAULT_INTERNAL_PORTS, parallelConfig } from './parallel-emulators.mjs';

const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
/** El .mjs no lleva tipos, así que la tabla se nombra aquí con la forma que tiene. */
const altPorts: Record<string, number> = ALT_PORTS;
/**
 * Los scripts de `package.json`. Los dos tests que los miran solo aplican cuando el proyecto
 * ya declara la tanda paralela (`test:emu:par`); mientras no exista, se omiten.
 */
function readScripts(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts ?? {};
  } catch {
    return {}; // Sin package.json (esqueleto aún incompleto) no hay scripts que comprobar.
  }
}
const scripts = readScripts();
const hasParallelScript = typeof scripts['test:emu:par'] === 'string';

describe('parallel-emulators', () => {
  it('cambia el puerto de todos los emuladores que declara firebase.json', () => {
    for (const [name, block] of Object.entries((config.emulators ?? {}) as Record<string, unknown>)) {
      if (typeof block !== 'object' || block === null || !('port' in block)) continue;
      expect(altPorts, `falta el puerto alterno de ${name}`).toHaveProperty(name);
      expect(altPorts[name]).not.toBe((block as { port: number }).port);
    }
  });

  it('ningún puerto alterno choca con los de la tanda por defecto, ni consigo mismo', () => {
    const ocupados = new Set<number>(Object.values(DEFAULT_INTERNAL_PORTS));
    for (const block of Object.values((config.emulators ?? {}) as Record<string, unknown>)) {
      if (typeof block === 'object' && block !== null && 'port' in block) {
        ocupados.add((block as { port: number }).port);
      }
    }
    const vistos = new Set<number>();
    for (const [name, port] of Object.entries(altPorts)) {
      expect(ocupados.has(port), `${name} en ${port} choca con la tanda por defecto`).toBe(false);
      expect(vistos.has(port), `${name} repite el puerto ${port}`).toBe(false);
      vistos.add(port);
    }
  });

  // `firebase emulators:exec` no inyecta ninguna variable para el emulador de Functions;
  // el cliente la lee de `FUNCTIONS_EMULATOR_HOST` (cliente de datos) y quien la pone
  // es el comando. Aquí se comprueba que el puerto que escribe es el mismo de arriba.
  it.skipIf(!hasParallelScript)('`test:emu:par` anuncia el puerto alterno de Functions', () => {
    expect(scripts['test:emu:par']).toContain(`FUNCTIONS_EMULATOR_HOST=127.0.0.1:${altPorts.functions}`);
    expect(scripts['test:emu:par']).toContain('--config firebase.paralelo.json');
  });

  // Los puertos no son lo único que las dos tandas se disputan: el emulador de Storage
  // guarda los objetos en `$TMPDIR/firebase/storage/blobs`, que es el mismo directorio para
  // las dos, así que el `clearStorage` de un carril borra los blobs del otro y la corrida
  // ajena muere con un `ENOENT` sobre un uuid. Por eso la tanda alterna lleva su propio
  // temporal. Que sea **corto** no es estética: `firebase-functions` abre ahí un socket de
  // dominio UNIX, y en macOS una ruta larga lo pasa del tope y los disparadores dejan de
  // llegar —se ve como pruebas de disparadores agotando la espera, no como un error de
  // ruta—. Medido con un temporal de ~106 caracteres: catorce pruebas caídas.
  it.skipIf(!hasParallelScript)('`test:emu:par` aísla el temporal del emulador con una ruta corta', () => {
    expect(scripts['test:emu:par']).toContain(`TMPDIR=${ALT_TMPDIR}`);
    expect(ALT_TMPDIR.startsWith('/')).toBe(true);
    expect(ALT_TMPDIR.length).toBeLessThanOrEqual(20);
    expect(scripts['test:emu'] ?? '').not.toContain('TMPDIR=');
  });

  it('el temporal alterno es corto y absoluto aunque package.json aún no declare la tanda', () => {
    expect(ALT_TMPDIR.startsWith('/')).toBe(true);
    expect(ALT_TMPDIR.length).toBeLessThanOrEqual(20);
  });

  it('el config alterno conserva reglas e índices y apaga el panel', () => {
    const alterno = parallelConfig(config);
    expect(alterno.firestore).toEqual(config.firestore);
    expect(alterno.storage).toEqual(config.storage);
    expect(alterno.hosting).toEqual(config.hosting);
    expect(alterno.emulators.ui).toEqual({ enabled: false, port: altPorts.ui });
    expect(alterno.emulators.firestore).toEqual({ port: altPorts.firestore });
    expect(alterno.emulators.singleProjectMode).toBe(true);
  });
});
