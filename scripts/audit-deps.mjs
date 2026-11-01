#!/usr/bin/env node
// RF-1 (014), RF-2 (014), RF-3 (014), RNF-1 (014) · D-T1 a D-T4 (014): auditoría de las dependencias de producción.
// Sin dependencias. Corre `npm audit --omit=dev --json` en la raíz y en functions/ y compara los avisos
// con el registro de excepciones (scripts/audit-exceptions.json). Sale con 1 si hay un aviso alto o
// crítico sin excepción, si una excepción venció o está mal formada, o si npm no devolvió un informe.
// Uso: node scripts/audit-deps.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Severidades que bloquean (D-5 (014)). */
const BLOCKING = new Set(['high', 'critical']);
const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Motivos por los que una entrada del registro no vale; vacío si está bien formada. */
function problems(exception) {
  if (typeof exception !== 'object' || exception === null) return ['no es un objeto'];
  const found = [];
  if (typeof exception.ghsa !== 'string' || !GHSA.test(exception.ghsa)) found.push('ghsa no es un identificador GHSA');
  for (const field of ['package', 'reason']) {
    if (typeof exception[field] !== 'string' || exception[field].trim() === '') found.push(`falta ${field}`);
  }
  const date = exception.reviewBy;
  if (typeof date !== 'string' || !DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    found.push('reviewBy no es una fecha AAAA-MM-DD');
  }
  return found;
}

/**
 * Compara los informes de `npm audit --json` (versión 2) con las excepciones a fecha `today` (AAAA-MM-DD, UTC).
 * Solo las entradas de `via` que son objetos son avisos; las de texto propagan el aviso a quien depende del
 * paquete vulnerable (D-T2 (014)). Una excepción vale hasta su `reviewBy` inclusive (D-T4 (014)).
 * @param {{ dir: string, report: any }[]} reports
 * @param {unknown} exceptions
 * @param {string} today
 */
export function evaluateAudit(reports, exceptions, today) {
  const list = Array.isArray(exceptions) ? exceptions : [];
  const invalid = Array.isArray(exceptions) ? [] : ['el registro de excepciones no es una lista'];
  const valid = [];
  for (const exception of list) {
    const found = problems(exception);
    if (found.length > 0) invalid.push(`${JSON.stringify(exception)}: ${found.join(', ')}`);
    else valid.push(exception);
  }
  const excepted = new Set(valid.map((exception) => `${exception.ghsa} ${exception.package}`));

  const blocking = new Map();
  for (const { dir, report } of reports) {
    for (const vulnerability of Object.values(report?.vulnerabilities ?? {})) {
      for (const via of vulnerability?.via ?? []) {
        if (typeof via !== 'object' || via === null || !BLOCKING.has(via.severity)) continue;
        const ghsa = String(via.url ?? '').split('/').pop() ?? '';
        const key = `${ghsa} ${via.name}`;
        if (excepted.has(key)) continue;
        const finding = blocking.get(key) ?? { ghsa, package: via.name, severity: via.severity, title: via.title, dirs: [] };
        if (!finding.dirs.includes(dir)) finding.dirs.push(dir);
        blocking.set(key, finding);
      }
    }
  }
  const expired = valid.filter((exception) => exception.reviewBy < today);
  return { blocking: [...blocking.values()], expired, invalid };
}

function audit(dir) {
  const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd: dir, encoding: 'utf8' });
  try {
    const report = JSON.parse(run.stdout);
    if (typeof report?.vulnerabilities !== 'object') throw new Error('sin «vulnerabilities»');
    return report;
  } catch (error) {
    throw new Error(`npm audit en ${dir} no devolvió un informe (${error.message}). ¿Hay red? Vuelve a correr la CI.\n${run.stderr}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const exceptions = JSON.parse(readFileSync(resolve(root, 'scripts/audit-exceptions.json'), 'utf8'));
    const reports = ['.', 'functions'].map((dir) => ({ dir, report: audit(resolve(root, dir)) }));
    const today = new Date().toISOString().slice(0, 10);
    const { blocking, expired, invalid } = evaluateAudit(reports, exceptions, today);
    for (const line of invalid) console.error(`Excepción mal formada: ${line}`);
    for (const exception of expired) {
      console.error(`Excepción vencida el ${exception.reviewBy}: ${exception.ghsa} en ${exception.package}. Renuévala o quítala (RF-3 (014)).`);
    }
    for (const finding of blocking) {
      console.error(`Aviso ${finding.severity} sin excepción: ${finding.ghsa} en ${finding.package} (${finding.dirs.join(', ')}): ${finding.title}`);
    }
    const ok = blocking.length + expired.length + invalid.length === 0;
    console.log(`audit-deps: ${ok ? 'sin avisos que bloqueen' : 'hay avisos que bloquean'} · excepciones registradas: ${exceptions.length}.`);
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error(`audit-deps: ${error.message}`);
    process.exit(1);
  }
}
