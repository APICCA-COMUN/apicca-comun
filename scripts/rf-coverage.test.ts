// Prueba del comprobador de cobertura. Es utillaje, no un requisito:
// sus `it` no citan ningún RF. El recorrido del comprobador salta el directorio
// `scripts/` de la raíz, así que las citas de los ejemplos de aquí abajo no cuentan
// como cobertura del repositorio real ni disparan el error de cita sin prefijo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'rf-coverage.mjs');

/** Árbol mínimo correcto: dos specs, dos pruebas, una cabecera y una regla citada. */
const VALID_TREE: Record<string, string> = {
  'specs/001-ejemplo/spec.md': ['# Spec 001', '', '**RF-1 · Uno**', '', '- **RNF-1 · Otro**', ''].join('\n'),
  'specs/002-ejemplo/spec.md': ['# Spec 002', '', '**RF-1 · Uno**', '', '**RF-2 · Dos**', ''].join('\n'),
  'scripts/rf-coverage.json': `${JSON.stringify(
    {
      '001': { all: ['RF-1', 'RNF-1'], pending: [] },
      '002': { all: ['RF-1', 'RF-2'], pending: ['RF-2'] },
    },
    null,
    2,
  )}\n`,
  'shared/domain/example.test.ts': [
    "import { describe, it } from 'vitest';",
    '',
    "describe('ejemplo', () => {",
    "  it('RF-1 (001): la primera spec queda cubierta', () => {});",
    "  it('RNF-1 (001): también su requisito no funcional', () => {});",
    "  it('RF-1 (002): la segunda spec cubre su propio requisito', () => {});",
    '});',
    '',
  ].join('\n'),
  'src/pages/ExamplePage.tsx': [
    '// RF-1 (001) · Página de ejemplo.',
    'export const ExamplePage = (): null => null;',
    '',
  ].join('\n'),
  'firestore.rules': [
    "rules_version = '2';",
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '    // RF-1 (001)',
    '    match /items/{id} {',
    '      allow read: if true;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n'),
};

const roots: string[] = [];

/** Monta el árbol en un directorio temporal y devuelve su raíz. */
function makeTree(changes: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'rf-coverage-'));
  roots.push(root);
  const files = { ...VALID_TREE, ...changes };
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

/** Ejecuta el comprobador real contra el árbol y devuelve su salida. */
function run(root: string): { code: number; output: string } {
  const result = spawnSync(process.execPath, [scriptPath, '--root', root, '--specs', join(root, 'specs')], {
    encoding: 'utf8',
  });
  return { code: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('rf-coverage', () => {
  it('un árbol con todas las citas prefijadas pasa y resume las dos specs', () => {
    const { code, output } = run(makeTree());
    expect(output).toContain('001: 2 exigidos con prueba, 0 pendientes');
    expect(output).toContain('002: 1 exigidos con prueba, 1 pendientes');
    expect(code).toBe(0);
  });

  it('una cita sin prefijo falla y nombra el archivo y la línea', () => {
    const root = makeTree({
      'shared/domain/example.test.ts': [
        "import { describe, it } from 'vitest';",
        '',
        "describe('ejemplo', () => {",
        "  it('RF-1 (001): la primera spec queda cubierta', () => {});",
        "  it('RNF-1 (001): también su requisito no funcional', () => {});",
        "  it('RF-1: cita sin prefijo', () => {});",
        '});',
        '',
      ].join('\n'),
    });
    const { code, output } = run(root);
    expect(code).toBe(1);
    expect(output).toContain('shared/domain/example.test.ts:6');
  });

  it('una decisión citada sin prefijo falla, y la prefijada pasa', () => {
    // Las tres specs numeran sus decisiones desde uno, así que `D-4` a secas nombra a tres
    // decisiones distintas y no dice cuál (D-T1 (002)).
    const sinPrefijo = run(
      makeTree({
        'src/pages/ExamplePage.tsx': [
          '// RF-1 (001) · Página de ejemplo, hecha como manda D-4.',
          'export const ExamplePage = (): null => null;',
          '',
        ].join('\n'),
      }),
    );
    expect(sinPrefijo.code).toBe(1);
    expect(sinPrefijo.output).toContain('src/pages/ExamplePage.tsx:1');
    expect(sinPrefijo.output).toContain('D-4');

    const conPrefijo = run(
      makeTree({
        'src/pages/ExamplePage.tsx': [
          '// RF-1 (001) · Página de ejemplo, hecha como manda D-4 (001).',
          'export const ExamplePage = (): null => null;',
          '',
        ].join('\n'),
      }),
    );
    expect(conPrefijo.output).not.toContain('D-4');
    expect(conPrefijo.code).toBe(0);
  });

  it('una decisión técnica citada sin prefijo falla, y el número largo no se confunde con el corto', () => {
    // `D-T1` es de las dos specs y dice cosas distintas en cada una, así que también se prefija.
    // Y `D-T13 (001)`, ya prefijada, no puede leerse como `D-T1` sin prefijo seguido de un `3`.
    const { code, output } = run(
      makeTree({
        'src/pages/ExamplePage.tsx': [
          '// RF-1 (001) · Página de ejemplo: escribe por la callable (D-T3), como D-T13 (001).',
          'export const ExamplePage = (): null => null;',
          '',
        ].join('\n'),
      }),
    );
    expect(code).toBe(1);
    expect(output).toContain('D-T3');
    expect(output).not.toContain('D-T13');
  });

  it('un requisito fuera de «pending» y sin prueba falla nombrándolo', () => {
    const root = makeTree({
      'scripts/rf-coverage.json': `${JSON.stringify(
        {
          '001': { all: ['RF-1', 'RNF-1'], pending: [] },
          '002': { all: ['RF-1', 'RF-2'], pending: [] },
        },
        null,
        2,
      )}\n`,
    });
    const { code, output } = run(root);
    expect(code).toBe(1);
    expect(output).toMatch(/002:.*RF-2/s);
  });

  it('un «all» que no coincide con su spec.md falla', () => {
    const root = makeTree({
      'scripts/rf-coverage.json': `${JSON.stringify(
        {
          '001': { all: ['RF-1', 'RNF-1'], pending: [] },
          '002': { all: ['RF-1', 'RF-2', 'RF-9'], pending: ['RF-2', 'RF-9'] },
        },
        null,
        2,
      )}\n`,
    });
    const { code, output } = run(root);
    expect(code).toBe(1);
    expect(output).toMatch(/002:.*RF-9/s);
  });

  it('la raíz de storage.rules no necesita cita, pero las rutas de dentro sí', () => {
    /** Un `storage.rules` con `inner` dentro del `match /b/{bucket}/o` de la raíz. */
    const storageRules = (inner: string[]): string =>
      ["rules_version = '2';", 'service firebase.storage {', '  match /b/{bucket}/o {', ...inner, '  }', '}', ''].join(
        '\n',
      );
    const cited = run(
      makeTree({
        'storage.rules': storageRules([
          '    // RNF-1 (001)',
          '    match /{allPaths=**} {',
          '      allow read, write: if false;',
          '    }',
        ]),
      }),
    );
    expect(cited.output).toContain('001: 2 exigidos con prueba, 0 pendientes');
    expect(cited.code).toBe(0);

    const uncited = run(
      makeTree({
        'storage.rules': storageRules(['    match /{allPaths=**} {', '      allow read: if true;', '    }']),
      }),
    );
    expect(uncited.code).toBe(1);
    expect(uncited.output).toContain('storage.rules:4');
  });

  it('un bloque que solo deniega no necesita cita, pero uno que concede sí', () => {
    const rules = (inner: string[]): string =>
      ["rules_version = '2';", 'service cloud.firestore {', '  match /databases/{database}/documents {', ...inner, '  }', '}', ''].join(
        '\n',
      );
    const deny = run(
      makeTree({
        'firestore.rules': rules(['    match /{document=**} {', '      allow read, write: if false;', '    }']),
      }),
    );
    expect(deny.code).toBe(0);

    const grant = run(
      makeTree({
        'firestore.rules': rules(['    match /{document=**} {', '      allow read: if true;', '    }']),
      }),
    );
    expect(grant.code).toBe(1);
    expect(grant.output).toContain('firestore.rules:4');
  });

  it('una cabecera sin cita con prefijo falla', () => {
    const root = makeTree({
      'src/pages/ExamplePage.tsx': ['// Página de ejemplo sin cita.', 'export const ExamplePage = (): null => null;', ''].join(
        '\n',
      ),
    });
    const { code, output } = run(root);
    expect(code).toBe(1);
    expect(output).toContain('src/pages/ExamplePage.tsx');
  });

  it('un rf-coverage.json vacío es válido: sin specs solo se vigilan las citas', () => {
    const vacio = run(makeTree({ 'scripts/rf-coverage.json': '{}\n', 'shared/domain/example.test.ts': '' }));
    expect(vacio.output).toContain('sin specs declaradas');
    expect(vacio.code).toBe(0);

    const sinPrefijo = run(
      makeTree({
        'scripts/rf-coverage.json': '{}\n',
        'shared/domain/example.test.ts': "// RF-1 sin prefijo\n",
      }),
    );
    expect(sinPrefijo.code).toBe(1);
    expect(sinPrefijo.output).toContain('shared/domain/example.test.ts:1');
  });

  it('el build de pruebas de navegador (`dist-browser`) queda fuera del recorrido', () => {
    // Lo compila `test:browser` (D-T13 (002)); su JS minificado no se revisa.
    const { code } = run(makeTree({ 'dist-browser/assets/index.js': 'const x = "RF-1";\n' }));
    expect(code).toBe(0);
  });

  it('sin firestore.rules ni carpetas de código citado el comprobador no falla', () => {
    const root = makeTree();
    rmSync(join(root, 'firestore.rules'));
    rmSync(join(root, 'src'), { recursive: true });
    const { code, output } = run(root);
    expect(output).toContain('001: 2 exigidos con prueba, 0 pendientes');
    expect(code).toBe(0);
  });
});

// Las specs son internas y no viajan en el repo público: en la CI no existen (RF-8 (013) v0.5).
const repoSpecs = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'specs');

describe.skipIf(!existsSync(repoSpecs))('rf-coverage.json del repositorio', () => {
  it('declara la spec 001 completa y sus pendientes son requisitos de la spec', () => {
    const scripts = dirname(scriptPath);
    const specsDir = resolve(scripts, '..', 'docs', 'specs');
    const folder = readdirSync(specsDir).find((name) => name.startsWith('001-'));
    expect(folder).toBeDefined();
    const spec = readFileSync(join(specsDir, folder ?? '', 'spec.md'), 'utf8');
    const declared = [...spec.matchAll(/^(?:- )?\*\*(RNF|RF)-(\d+) · /gm)].map((m) => `${m[1]}-${m[2]}`);
    expect(declared).toHaveLength(32);

    const config = JSON.parse(readFileSync(join(scripts, 'rf-coverage.json'), 'utf8')) as Record<
      string,
      { all: string[]; pending: string[] }
    >;
    expect(config['001']?.all).toEqual(declared);
    expect(declared).toEqual(expect.arrayContaining(config['001']?.pending ?? []));
  });
  it('declara la spec 002 completa, con sus pendientes dentro de «all»', () => {
    const scripts = dirname(scriptPath);
    const specsDir = resolve(scripts, '..', 'docs', 'specs');
    const folder = readdirSync(specsDir).find((name) => name.startsWith('002-'));
    expect(folder).toBeDefined();
    const spec = readFileSync(join(specsDir, folder ?? '', 'spec.md'), 'utf8');
    const declared = [...spec.matchAll(/^(?:- )?\*\*(RNF|RF)-(\d+) · /gm)].map((m) => `${m[1]}-${m[2]}`);
    expect(declared).toHaveLength(19);

    const config = JSON.parse(readFileSync(join(scripts, 'rf-coverage.json'), 'utf8')) as Record<
      string,
      { all: string[]; pending: string[] }
    >;
    expect(config['002']?.all).toEqual(declared);
    expect(declared).toEqual(expect.arrayContaining(config['002']?.pending ?? []));
  });
});
