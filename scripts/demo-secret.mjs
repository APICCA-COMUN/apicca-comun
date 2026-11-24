// RNF-1 (022), D-T6 (022): la sal del hash de IP para los emuladores de `npm run demo`. El emulador de Functions lee los
// secretos de `functions/.secret.local`; si falta, se crea con una sal aleatoria que solo vale en esta máquina. Nunca
// pisa un archivo que ya existe. `.gitignore` lo deja fuera de git y `firebase.json` no lo sube (`*.local`).
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Crea el archivo con `IP_HASH_SALT=solo-local-<hex>` si no existe. Devuelve si lo creó. */
export function ensureDemoSecret(path) {
  if (existsSync(path)) return false;
  writeFileSync(path, `IP_HASH_SALT=solo-local-${randomBytes(16).toString('hex')}\n`, { mode: 0o600 });
  return true;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(fileURLToPath(new URL('..', import.meta.url)), 'functions/.secret.local');
  if (ensureDemoSecret(path)) console.log('Sal local de los emuladores creada en functions/.secret.local.');
}
