// Puertos de los emuladores según el carril. El de siempre son los de `firebase.json`; el paralelo (`par`), los de
// `firebase.paralelo.json` (scripts/parallel-emulators.mjs), para correr `test:browser:par` junto a otra tanda.
// Lo leen la app (`VITE_EMULATOR_LANE`, al compilar) y las pruebas de navegador (la misma variable, en Node).

export interface EmulatorPorts {
  auth: number;
  firestore: number;
  functions: number;
  storage: number;
  /** El `vite preview` de las pruebas de navegador. */
  preview: number;
}

export const DEFAULT_EMULATOR_PORTS: EmulatorPorts = { auth: 9099, firestore: 8080, functions: 5001, storage: 9199, preview: 4174 };
export const PARALLEL_EMULATOR_PORTS: EmulatorPorts = { auth: 9599, firestore: 8580, functions: 5501, storage: 9699, preview: 4674 };

/** Puertos y carpeta del build de pruebas del carril pedido; cualquier valor que no sea `par` es el de siempre. */
export function emulatorLane(lane: string | undefined): { ports: EmulatorPorts; outDir: string } {
  return lane === 'par' ? { ports: PARALLEL_EMULATOR_PORTS, outDir: 'dist-browser-par' } : { ports: DEFAULT_EMULATOR_PORTS, outDir: 'dist-browser' };
}
