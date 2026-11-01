// RF-1 (014), RF-2 (014), RF-3 (014), RF-5 (014), RF-6 (014), RNF-1 (014) · D-T9 (014): la auditoría se prueba
// con informes de npm escritos a mano, sin red; la CI, Dependabot y la versión de Node se vigilan como texto.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- .mjs sin tipos, como scripts/rf-coverage.mjs.
import { evaluateAudit } from '../../scripts/audit-deps.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string): string => {
  const full = resolve(root, path);
  expect(existsSync(full), `falta ${path}`).toBe(true);
  return readFileSync(full, 'utf8');
};

type Exception = { ghsa: string; package: string; reason: string; reviewBy: string };
type Finding = { ghsa: string; package: string; severity: string };
type Result = { blocking: Finding[]; expired: Exception[]; invalid: string[] };
const evaluate = evaluateAudit as (
  reports: { dir: string; report: unknown }[],
  exceptions: unknown,
  today: string,
) => Result;

/** Un informe de `npm audit --json` (versión 2) con un aviso en `pkg` y su propagación a `parent`. */
function report(pkg: string, ghsa: string, severity: string, parent = 'firebase'): unknown {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      [pkg]: {
        name: pkg,
        severity,
        isDirect: false,
        via: [{ source: 1, name: pkg, title: 'Aviso de prueba', url: `https://github.com/advisories/${ghsa}`, severity, range: '<9.9.9' }],
      },
      [parent]: { name: parent, severity, isDirect: true, via: [pkg] },
    },
  };
}
const empty = { auditReportVersion: 2, vulnerabilities: {} };
const grpc: Exception = {
  ghsa: 'GHSA-m9gg-hp2v-232j',
  package: '@grpc/grpc-js',
  reason: 'Solo afecta a servidores gRPC; en el navegador Firestore no usa grpc-js.',
  reviewBy: '2027-01-13',
};

describe('dependencias · auditoría', () => {
  it('RF-1 (014) · 1.1: un aviso alto sin excepción bloquea, y solo una vez aunque lo propaguen otros paquetes', () => {
    const result = evaluate([{ dir: '.', report: report('@grpc/grpc-js', grpc.ghsa, 'high') }], [], '2026-10-15');
    expect(result.blocking).toEqual([expect.objectContaining({ ghsa: grpc.ghsa, package: '@grpc/grpc-js', severity: 'high' })]);
  });

  it('RF-1 (014) · 1.2: un aviso crítico bloquea (D-5 (014))', () => {
    const result = evaluate([{ dir: 'functions', report: report('sharp', 'GHSA-aaaa-bbbb-cccc', 'critical') }], [], '2026-10-15');
    expect(result.blocking.map((finding) => finding.package)).toEqual(['sharp']);
  });

  it('RF-1 (014) · 1.3: los avisos moderados y bajos no bloquean (D-5 (014))', () => {
    const result = evaluate(
      [
        { dir: '.', report: report('vite', 'GHSA-aaaa-bbbb-cccc', 'moderate') },
        { dir: 'functions', report: report('sharp', 'GHSA-dddd-eeee-ffff', 'low') },
      ],
      [],
      '2026-10-15',
    );
    expect(result.blocking).toEqual([]);
  });

  it('RF-1 (014) · 1.4: el mismo aviso en la raíz y en functions aparece una sola vez', () => {
    const r = report('@grpc/grpc-js', grpc.ghsa, 'high');
    const result = evaluate([{ dir: '.', report: r }, { dir: 'functions', report: r }], [], '2026-10-15');
    expect(result.blocking).toHaveLength(1);
  });

  it('RF-1 (014) · 1.5: sin avisos no hay nada que bloquee', () => {
    expect(evaluate([{ dir: '.', report: empty }, { dir: 'functions', report: empty }], [], '2026-10-15')).toEqual({
      blocking: [],
      expired: [],
      invalid: [],
    });
  });

  it('RF-2 (014) · 2.1: un aviso con excepción registrada no bloquea', () => {
    const result = evaluate([{ dir: '.', report: report('@grpc/grpc-js', grpc.ghsa, 'high') }], [grpc], '2026-10-15');
    expect(result).toEqual({ blocking: [], expired: [], invalid: [] });
  });

  it('RF-2 (014) · 2.2: la excepción vale solo para su paquete', () => {
    const result = evaluate([{ dir: '.', report: report('otro-paquete', grpc.ghsa, 'high') }], [grpc], '2026-10-15');
    expect(result.blocking.map((finding) => finding.package)).toEqual(['otro-paquete']);
  });

  it('RF-2 (014) · 2.3: una excepción sin motivo, sin paquete o con fecha inválida se rechaza', () => {
    const malformed = [
      { ...grpc, reason: '' },
      { ghsa: grpc.ghsa, reason: grpc.reason, reviewBy: grpc.reviewBy },
      { ...grpc, reviewBy: '13/01/2027' },
      { ...grpc, ghsa: 'CVE-2026-1' },
    ];
    for (const exception of malformed) {
      expect(evaluate([{ dir: '.', report: empty }], [exception], '2026-10-15').invalid, JSON.stringify(exception)).toHaveLength(1);
    }
  });

  it('RF-2 (014) · 2.4: el registro de excepciones existe y anota grpc-js con su motivo y su fecha (D-1 (014))', () => {
    const exceptions = JSON.parse(read('scripts/audit-exceptions.json')) as Exception[];
    expect(exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ ghsa: grpc.ghsa, package: '@grpc/grpc-js' })]));
    expect(evaluate([{ dir: '.', report: empty }], exceptions, '2026-10-15').invalid).toEqual([]);
  });

  it('RF-3 (014) · 3.1: una excepción vencida falla, aunque el aviso siga registrado', () => {
    const result = evaluate([{ dir: '.', report: report('@grpc/grpc-js', grpc.ghsa, 'high') }], [grpc], '2027-01-14');
    expect(result.expired).toEqual([grpc]);
  });

  it('RF-3 (014) · 3.2: el mismo día de la fecha de revisión la excepción todavía vale', () => {
    expect(evaluate([{ dir: '.', report: empty }], [grpc], '2027-01-13').expired).toEqual([]);
  });

  it('RF-3 (014) · 3.3: una excepción vencida falla aunque el aviso ya no aparezca', () => {
    expect(evaluate([{ dir: '.', report: empty }], [grpc], '2027-02-01').expired).toEqual([grpc]);
  });
});

describe('dependencias · CI y Dependabot', () => {
  it('RF-1 (014) · 1.6: la CI corre audit-deps después de instalar y antes de check', () => {
    const ci = read('.github/workflows/ci.yml');
    const steps = ['npm --prefix functions ci', 'npm run audit-deps', 'npm run check'];
    const positions = steps.map((step) => ci.indexOf(`run: ${step}`));
    for (const [i, position] of positions.entries()) expect(position, steps[i]).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect((JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts['audit-deps']).toBe(
      'node scripts/audit-deps.mjs',
    );
  });

  it('RF-6 (014) · 6.1: Dependabot revisa cada semana la raíz, functions y las acciones (D-2 (014))', () => {
    const config = read('.github/dependabot.yml');
    expect(config).toMatch(/^version: 2$/m);
    for (const [ecosystem, directory] of [['npm', '/'], ['npm', '/functions'], ['github-actions', '/']] as const) {
      expect(config, `${ecosystem} en ${directory}`).toMatch(
        new RegExp(`- package-ecosystem: ${ecosystem}\\s*\\n\\s+directory: ${directory.replace('/', '\\/')}\\s*\\n`),
      );
    }
    expect(config.match(/interval: weekly/g)).toHaveLength(3);
  });

  it('RF-6 (014) · 6.2: las menores y los parches van agrupados y las mayores se ignoran (RF-4 (014))', () => {
    const config = read('.github/dependabot.yml');
    expect(config.match(/update-types:\s*\n\s+- minor\s*\n\s+- patch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(config.match(/version-update:semver-major/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('dependencias · Node', () => {
  it('RF-5 (014) · 5.1: la CI, las functions, firebase.json y AGENTS.md usan Node 24 (D-3 (014))', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/node-version:\s*'24'/);
    expect((JSON.parse(read('functions/package.json')) as { engines: { node: string } }).engines.node).toBe('24');
    // firebase.paralelo.json se genera desde firebase.json (scripts/parallel-emulators.mjs) y no se versiona.
    const runtimes = read('firebase.json').match(/"runtime":\s*"(nodejs\d+)"/g) ?? [];
    expect(runtimes.length).toBeGreaterThan(0);
    for (const runtime of runtimes) expect(runtime).toContain('nodejs24');
    expect(read('AGENTS.md')).toContain('Node 24');
  });
});

describe('dependencias · sin paquetes nuevos', () => {
  it('RNF-1 (014): audit-deps.mjs solo importa módulos de Node', () => {
    const imports = [...read('scripts/audit-deps.mjs').matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const module of imports) expect(module).toMatch(/^node:/);
  });
});
