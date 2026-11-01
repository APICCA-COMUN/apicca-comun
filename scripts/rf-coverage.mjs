#!/usr/bin/env node
// Comprobador de cobertura por requisito (Principio 5 de la constitución).
// Sin dependencias. Lee scripts/rf-coverage.json, con una clave por spec:
//   { "001": { "all": [...], "pending": [...] }, "002": { "all": [...], "pending": [...] } }
// Las cadenas van sin prefijo porque la clave ya dice de qué spec son.
// Toda cita del código lleva el número de su spec entre paréntesis:
// `RF-7 (002)` cubre el RF-7 de la 002 y no el homónimo de la 001. El comprobador:
//   1. exige que cada requisito de `all` que no esté en `pending` tenga una prueba
//      que lo nombre con su prefijo en un archivo *.test.ts o *.test.tsx;
//   2. compara cada `all` con el spec.md de su número (docs/specs/NNN-…/spec.md), si es legible;
//   3. falla si alguna cita de un archivo .ts, .tsx, .mjs, .cjs, .js o .rules no lleva
//      prefijo, nombrando archivo y línea; vale para requisitos (`RF-7`, `RNF-3`) y para
//      decisiones (`D-83`, `D-T3`), que cada spec numera desde uno;
//   4. exige la cita en el código (Principio 2): cada archivo de src/pages,
//      src/components y functions/src/ops (las carpetas que no existan se omiten) empieza con un comentario que cita su
//      requisito con prefijo, y cada bloque `match` de firestore.rules y storage.rules,
//      salvo el raíz de la base de datos, lo lleva en la línea inmediatamente anterior
//      (si el archivo de reglas no existe, no se comprueba). Los bloques que solo deniegan
//      (`allow …: if false;`, la denegación por defecto) no necesitan cita.
//   Sin ninguna spec declarada en rf-coverage.json (`{}`), el comprobador solo vigila las
//   citas sin prefijo, las cabeceras y las reglas.
// El directorio `scripts/` de la raíz queda fuera del recorrido: es utillaje, no código
// del sitio, así que ni cuenta como cobertura ni se le exige prefijo.
// Uso: node scripts/rf-coverage.mjs [--root <dir>] [--specs <dir>]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'lib', 'lib-scripts', '.git', '.firebase', 'dist-browser', 'dist-browser-par']);
const CITED_DIRS = ['src/pages', 'src/components', 'functions/src/ops'];
const RULES_FILES = [
  { name: 'firestore.rules', required: false },
  { name: 'storage.rules', required: false },
];
// Cita completa: el requisito y, entre paréntesis, el número de tres cifras de su spec.
const CITED = String.raw`(RNF|RF)-(\d+) \((\d{3})\)`;
const CITATION_IN_COMMENT = new RegExp(String.raw`\/\/\s*${CITED}`);
// El `\b` tras el número es obligatorio: sin él, `RF-29 (001)` casaría por retroceso
// como `RF-2` seguido de `9`, y toda cita de dos cifras se daría por no prefijada.
//
// **Las decisiones se prefijan igual que los requisitos**: las
// specs numeran sus decisiones desde uno, así que `D-4` a secas nombra a tres decisiones
// distintas y no dice cuál. `D-T3` es peor todavía, porque dos specs pueden llamar así a
// decisiones técnicas que no se parecen en nada. La alternativa larga va antes que la corta
// para que `D-T3` no se lea como una `D` seguida de una `T`.
const UNPREFIXED = /\b(?:RNF-\d+|RF-\d+|D-T\d+|D-\d+)\b(?! \(\d{3}\))/g;
const CODE_FILE = /\.(ts|tsx|mjs|cjs|js|rules)$/;
const TEST_FILE = /\.test\.tsx?$/;
const SPEC_REQUIREMENT = /^(?:- )?\*\*(RNF|RF)-(\d+) · /gm;
// Las dos raíces de los archivos de reglas: la base de datos de Firestore y el bucket
// de Storage. No cubren ninguna ruta ni conceden nada, así que no citan requisito.
const ROOT_MATCH = /^\s*match\s+(?:\/databases\/\{[^}]+\}\/documents|\/b\/\{[^}]+\}\/o)\s*\{/;

const errors = [];

/** Lee `--root` y `--specs` de la línea de órdenes; sin ellos trabaja sobre este repositorio. */
function readOptions(argv) {
  const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let root = here;
  let specsDir = null;
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    if (argv[i] === '--root' && value !== undefined) {
      root = resolve(value);
      i += 1;
    } else if (argv[i] === '--specs' && value !== undefined) {
      specsDir = resolve(value);
      i += 1;
    }
  }
  return { root, specsDir: specsDir ?? resolve(root, 'docs', 'specs') };
}

function requirementKey(text) {
  // Orden natural: los RF por número y después los RNF.
  const m = /^(RF|RNF)-(\d+)$/.exec(text);
  return m ? [m[1] === 'RF' ? 0 : 1, Number(m[2])] : [2, 0];
}

function sortRequirements(list) {
  return [...list].sort((a, b) => {
    const [ka, na] = requirementKey(a);
    const [kb, nb] = requirementKey(b);
    return ka - kb || na - nb;
  });
}

function walk(root, dir, visit) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (relative(root, path) === 'scripts') continue; // Utillaje, fuera del recorrido.
      walk(root, path, visit);
    } else visit(path);
  }
}

/** Devuelve una lista `{ spec, all, pending }` ordenada por número de spec, o `null`. */
function readConfig(root) {
  const configPath = join(root, 'scripts', 'rf-coverage.json');
  const shown = relative(root, configPath);
  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    errors.push(`No se pudo leer ${shown}: ${error.message}`);
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${shown} debe ser un objeto con una clave por spec.`);
    return null;
  }
  const isList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const specs = [];
  for (const [spec, value] of Object.entries(raw)) {
    if (!/^\d{3}$/.test(spec)) {
      errors.push(`${shown}: la clave "${spec}" no es el número de tres cifras de una spec.`);
      continue;
    }
    if (value === null || typeof value !== 'object' || !isList(value.all) || !isList(value.pending)) {
      errors.push(`${shown}: la spec ${spec} debe tener las listas "all" y "pending" de cadenas.`);
      continue;
    }
    const outside = value.pending.filter((r) => !value.all.includes(r));
    if (outside.length > 0) {
      errors.push(`${spec}: en "pending" hay requisitos que no están en "all": ${outside.join(', ')}.`);
    }
    specs.push({ spec, all: value.all, pending: value.pending });
  }
  // Un objeto vacío es válido: el esqueleto aún no tiene specs que declarar.
  return specs.sort((a, b) => a.spec.localeCompare(b.spec));
}

/** Requisitos nombrados por alguna prueba, agrupados por el número de spec de la cita. */
function collectTestedRequirements(root) {
  const tested = new Map();
  const citation = new RegExp(CITED, 'g');
  walk(root, root, (path) => {
    if (!TEST_FILE.test(path)) return;
    for (const match of readFileSync(path, 'utf8').matchAll(citation)) {
      const [, kind, number, spec] = match;
      if (!tested.has(spec)) tested.set(spec, new Set());
      tested.get(spec).add(`${kind}-${number}`);
    }
  });
  return tested;
}

/** Ninguna cita del código puede quedarse sin el número de su spec (D-T1). */
function checkCitationPrefixes(root) {
  walk(root, root, (path) => {
    if (!CODE_FILE.test(path)) return;
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, i) => {
      UNPREFIXED.lastIndex = 0;
      const match = UNPREFIXED.exec(line);
      if (match === null) return;
      errors.push(
        `${relative(root, path)}:${i + 1} la cita \`${match[0]}\` no lleva el número de su spec (\`${match[0]} (001)\`).`,
      );
    });
  });
}

function checkSpecAgreement(root, specsDir, specs) {
  let entries;
  try {
    entries = readdirSync(specsDir, { withFileTypes: true });
  } catch {
    return; // Sin las specs a mano (por ejemplo, fuera de la máquina de desarrollo) no se comprueba.
  }
  for (const { spec, all } of specs) {
    const folder = entries.find((e) => e.isDirectory() && e.name.startsWith(`${spec}-`));
    if (folder === undefined) {
      errors.push(`${spec}: no hay ninguna carpeta \`${spec}-…\` en ${relative(root, specsDir)}.`);
      continue;
    }
    const specPath = join(specsDir, folder.name, 'spec.md');
    let text;
    try {
      text = readFileSync(specPath, 'utf8');
    } catch (error) {
      errors.push(`${spec}: no se pudo leer ${relative(root, specPath)}: ${error.message}`);
      continue;
    }
    const declared = new Set();
    // Cada requisito de la spec abre con `**RF-n · Título**` (los RNF, como viñeta `- **RNF-n · …`).
    for (const match of text.matchAll(SPEC_REQUIREMENT)) declared.add(`${match[1]}-${match[2]}`);
    const allSet = new Set(all);
    const missing = sortRequirements([...declared].filter((r) => !allSet.has(r)));
    const extra = sortRequirements(all.filter((r) => !declared.has(r)));
    if (missing.length > 0) {
      errors.push(`${spec}: la spec define requisitos que faltan en "all": ${missing.join(', ')}.`);
    }
    if (extra.length > 0) {
      errors.push(`${spec}: "all" tiene requisitos que la spec no define: ${extra.join(', ')}.`);
    }
  }
}

function checkSourceHeaders(root) {
  for (const dir of CITED_DIRS) {
    const path = join(root, dir);
    let isDir = false;
    try {
      isDir = statSync(path).isDirectory();
    } catch {
      continue; // La carpeta aún no existe (llega con su hito).
    }
    if (!isDir) continue;
    walk(root, path, (file) => {
      if (!/\.tsx?$/.test(file) || TEST_FILE.test(file)) return;
      const firstLine = readFileSync(file, 'utf8').split('\n', 1)[0] ?? '';
      if (!CITATION_IN_COMMENT.test(firstLine) || !firstLine.trimStart().startsWith('//')) {
        errors.push(
          `${relative(root, file)} no empieza con un comentario \`// RF-… (nnn)\` que cite su requisito con el número de su spec.`,
        );
      }
    });
  }
}

/**
 * Un bloque `match` que solo deniega (todas sus `allow` terminan en `if false`) no concede
 * nada y, por tanto, no responde a ningún requisito: es la denegación por defecto.
 * Se considera el bloque hasta la primera línea que sea solo `}`.
 */
function isDenyAllBlock(lines, start) {
  const allows = [];
  for (let j = start + 1; j < lines.length; j += 1) {
    const text = lines[j] ?? '';
    if (/^\s*}\s*$/.test(text)) break;
    if (/^\s*match\s+\//.test(text)) return false; // Bloque anidado: no es una hoja.
    if (/^\s*allow\b/.test(text)) allows.push(text);
  }
  return allows.length > 0 && allows.every((text) => /:\s*if\s+false\s*;/.test(text));
}

function checkRulesCitations(root) {
  for (const { name, required } of RULES_FILES) {
    let lines;
    try {
      lines = readFileSync(join(root, name), 'utf8').split('\n');
    } catch {
      if (required) errors.push(`No se pudo leer ${name}.`);
      continue; // storage.rules llega con su hito.
    }
    lines.forEach((line, i) => {
      if (!/^\s*match\s+\//.test(line) || ROOT_MATCH.test(line)) return;
      if (isDenyAllBlock(lines, i)) return;
      const previous = lines[i - 1] ?? '';
      if (!CITATION_IN_COMMENT.test(previous)) {
        errors.push(`${name}:${i + 1} el bloque \`${line.trim()}\` no lleva \`// RF-… (nnn)\` justo antes.`);
      }
    });
  }
}

function main() {
  const { root, specsDir } = readOptions(process.argv.slice(2));
  const specs = readConfig(root);
  if (specs !== null && specs.length === 0) {
    checkCitationPrefixes(root);
    checkSourceHeaders(root);
    checkRulesCitations(root);
    if (errors.length === 0) console.log('rf-coverage: sin specs declaradas todavía.');
  } else if (specs !== null) {
    const tested = collectTestedRequirements(root);
    const summary = [];
    for (const { spec, all, pending } of specs) {
      const waiting = new Set(pending);
      const required = all.filter((r) => !waiting.has(r));
      const covered = tested.get(spec) ?? new Set();
      const untested = sortRequirements(required.filter((r) => !covered.has(r)));
      if (untested.length > 0) {
        errors.push(`${spec}: requisitos exigidos sin ninguna prueba que los nombre: ${untested.join(', ')}.`);
      }
      summary.push(`${spec}: ${required.length} exigidos con prueba, ${waiting.size} pendientes`);
    }
    checkSpecAgreement(root, specsDir, specs);
    checkCitationPrefixes(root);
    checkSourceHeaders(root);
    checkRulesCitations(root);
    if (errors.length === 0) console.log(`rf-coverage: ${summary.join(' · ')}.`);
  }
  if (errors.length > 0) {
    console.error('rf-coverage: fallo.');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

main();
