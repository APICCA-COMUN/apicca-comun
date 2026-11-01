// T-7.7: revisión transversal de textos. Toda cadena que ve una persona está en español latino con tildes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, MESSAGES } from './messages';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'lib', 'coverage']);

/** Archivos de código de producción (sin pruebas) de las tres carpetas con texto visible. */
function sources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

// Palabras que, sin su tilde, delatan un texto mal escrito. Se omiten las que son también rutas
// (`/accion`, `/facilitacion`) o formas verbales válidas (`pagina`, `publico`).
const WITHOUT_ACCENT =
  /\b(sesion|invitacion|contrasena|energia|ubicacion|inscripcion|informacion|direccion|despues|ademas|minimo|maximo|valido|invalido|ultima|numero|codigo|tambien|facil|vacio|descripcion|opcion|seleccion|revision|edicion|autoria|segun|todavia|aqui)\b/i;

// La clave sin tilde de un eje como identificador: en un token (`axis-energia-fill`), como
// literal exacto (`'energia'`) o como clave de objeto (`energia:`).
const AXIS_KEY_IDENTIFIER = /-energia-|(['"`])energia\1|\benergia:/g;

// Palabras inglesas que no existen en español: una sola basta para señalar un texto en otro idioma.
const ENGLISH =
  /\b(the|and|you|your|please|failed|invalid|cannot|could not|must be|not found|loading|submit|cancel|password|already|permission denied|something went wrong|try again)\b/i;

describe('textos de la interfaz y de los errores', () => {
  it('RNF-1 (001): ningún mensaje de error está en inglés', () => {
    for (const code of ERROR_CODES) expect(MESSAGES[code], code).not.toMatch(ENGLISH);
  });

  it('RNF-1 (001): los mensajes de error empiezan en mayúscula y llevan sus signos de apertura', () => {
    for (const code of ERROR_CODES) {
      const text = MESSAGES[code];
      expect(text, code).toMatch(/^[¿¡A-ZÁÉÍÓÚÑ]/);
      if (text.includes('?')) expect(text, code).toContain('¿');
      if (text.includes('!')) expect(text, code).toContain('¡');
    }
  });

  it('RNF-1 (001): el código de src, shared y functions no trae palabras sin su tilde', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'shared', 'functions/src']) {
      for (const file of sources(join(ROOT, dir))) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            if (/^\s*import\b|\bfrom '|pattern:|href:/.test(line)) return;
            // La clave de eje `energia` va sin tilde porque forma nombres de token (§4.0 de la spec 002).
            const hit = WITHOUT_ACCENT.exec(line.replace(AXIS_KEY_IDENTIFIER, ''));
            if (hit !== null) offenders.push(`${relative(ROOT, file)}:${index + 1} «${hit[0]}»`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('RNF-1 (001): el texto visible de src no está en inglés', () => {
    const offenders: string[] = [];
    for (const file of sources(join(ROOT, 'src'))) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/^\s*(import\b|\/\/|\*|\/\*)|\bfrom '/.test(line)) return;
          const literals = line.match(/(['"`])(?:\\.|(?!\1).)*\1|>[^<>{}]+</g) ?? [];
          for (const literal of literals) {
            // Una palabra suelta entre comillas es un valor técnico (`'loading'`, `"submit"`): solo las frases
            // y el texto JSX (`>Cancel<`) son texto visible.
            const isPhrase = literal.startsWith('>') || /\s/.test(literal.slice(1, -1));
            if (isPhrase && ENGLISH.test(literal)) offenders.push(`${relative(ROOT, file)}:${index + 1} ${literal}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
