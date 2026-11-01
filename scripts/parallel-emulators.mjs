#!/usr/bin/env node
// Segunda tanda de emuladores, para trabajar dos ramas a la vez. Escribe
// `firebase.paralelo.json`: el mismo firebase.json con los puertos cambiados, para que
// `npm run test:emu:par` no se pelee por los puertos con la tanda por defecto que esté
// corriendo en otro árbol de trabajo. El archivo se genera y no se versiona; así no puede
// quedarse atrás cuando firebase.json cambie.
//
// Los puertos no se calculan sumando un desplazamiento: sumar 500 a los del panel dejaría
// el de registro en 5000, que es el de `hosting` de la tanda por defecto. Van escritos uno
// a uno y `parallel-emulators.test.ts` comprueba que están todos y que ninguno choca.
//
// Los cuatro últimos no aparecen en firebase.json porque allí valen sus valores por
// defecto (hub 4400, registro 4500, eventarc 9299, tareas 9499); aquí sí hay que nombrarlos,
// porque son justo los que la otra tanda ya tiene tomados.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const ALT_PORTS = {
  auth: 9599,
  firestore: 8580,
  functions: 5501,
  storage: 9699,
  hosting: 5500,
  ui: 4501,
  hub: 4900,
  logging: 4901,
  eventarc: 9901,
  tasks: 9902,
};

/**
 * El temporal propio de la tanda alterna. Los puertos no son lo único que las dos tandas se
 * disputan: el emulador de Storage guarda los objetos en `$TMPDIR/firebase/storage/blobs`,
 * que sin esto es el mismo directorio para las dos, de modo que el `clearStorage` de un
 * carril borra los blobs del otro y la corrida ajena muere con un `ENOENT` sobre un uuid,
 * lejos de donde está la causa.
 *
 * **Corto a propósito, y por eso en `/tmp` y no en el árbol.** `firebase-functions` abre
 * aquí un socket de dominio UNIX, cuya ruta tiene un tope de longitud en macOS; con un
 * temporal largo el socket no se crea y los disparadores dejan de llegar, lo que se ve como
 * pruebas de disparadores agotando la espera y no como un error de ruta. La prueba fija
 * el tope en 20 caracteres para que nadie lo alargue sin enterarse.
 */
export const ALT_TMPDIR = '/tmp/apicca-emu-par';

/** Los puertos que la tanda por defecto ocupa: los de firebase.json y los internos del CLI. */
export const DEFAULT_INTERNAL_PORTS = { hub: 4400, logging: 4500, eventarc: 9299, tasks: 9499 };

/**
 * El config alterno a partir del de siempre. El panel se apaga —dos paneles a la vez
 * confunden más de lo que ayudan— y `singleProjectMode` se mantiene por si el original
 * lo trae. Todo lo demás (reglas, índices, predeploy) queda igual: es el mismo proyecto.
 */
export function parallelConfig(config, altPorts = ALT_PORTS) {
  const emulators = { singleProjectMode: true };
  for (const [name, port] of Object.entries(altPorts)) {
    emulators[name] = name === 'ui' ? { enabled: false, port } : { port };
  }
  return { ...config, emulators };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // El temporal tiene que existir antes de que `emulators:exec` arranque: el CLI no lo crea.
  mkdirSync(ALT_TMPDIR, { recursive: true });
  const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
  writeFileSync('firebase.paralelo.json', `${JSON.stringify(parallelConfig(config), null, 2)}\n`);
  const linea = Object.entries(ALT_PORTS)
    .map(([nombre, puerto]) => `${nombre} ${puerto}`)
    .join(', ');
  console.log(`firebase.paralelo.json escrito: ${linea}. Temporal propio: ${ALT_TMPDIR}.`);
}
