// Frontera del dominio (Principio 4): `shared/domain/` es puro, lo importan por igual `src/`
// y `functions/`, así que no puede tocar React, Firebase ni el navegador.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const domainDir = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"](?:react|react-dom|firebase|firebase-admin|firebase-functions)(?:\/[^'"]*)?['"]/;
const FORBIDDEN_GLOBAL = /\b(?:document|window)\b\s*[.[]/;

/** Devuelve las razones por las que un módulo de dominio rompe la frontera. */
function boundaryViolations(source: string): string[] {
  const found: string[] = [];
  source.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (FORBIDDEN_IMPORT.test(code)) found.push(`línea ${i + 1}: importa un paquete prohibido`);
    if (FORBIDDEN_GLOBAL.test(code)) found.push(`línea ${i + 1}: usa document o window`);
  });
  return found;
}

function domainModules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return domainModules(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('shared/domain · frontera', () => {
  it('ningún módulo de dominio importa react ni firebase ni usa document o window', () => {
    const offenders = domainModules(domainDir).flatMap((path) =>
      boundaryViolations(readFileSync(path, 'utf8')).map((v) => `${relative(domainDir, path)}: ${v}`),
    );
    expect(offenders).toEqual([]);
  });

  it('recorre también shared/domain/identity, cuyo index.ts reexporta la API pública (D-T3 (002))', async () => {
    const modules = domainModules(domainDir).map((path) => relative(domainDir, path));
    expect(modules).toContain(join('identity', 'index.ts'));
    const identity = await import('./identity');
    for (const name of [
      'TOKENS', 'TOKEN_NAMES', 'THEMES', 'MAP_TINT', 'contrastRatio', 'relativeLuminance', 'deltaE2000',
      'REQUIRED_PAIRS', 'failingPairs', 'AXIS_IDENTITY', 'axisIdentity', 'AXIS_ICONS', 'LOGO', 'FAVICON',
      'resolveTheme', 'buildingScale', 'BUILDING_CELL', 'pinSize', 'pinAccessibleName', 'sortAxes',
    ]) expect(identity, name).toHaveProperty(name);
  });

  it('D-T6 (004): recorre también shared/domain/constitution, cuyo index.ts reexporta la API pública', async () => {
    const modules = domainModules(domainDir).map((path) => relative(domainDir, path));
    expect(modules).toContain(join('constitution', 'index.ts'));
    const constitution = await import('./constitution');
    const domain = await import('./index');
    for (const name of [
      'DELIBERATION_HOURS', 'dueAt', 'extendedDueAt', 'isDue', 'evaluateClose', 'slotKeyOf', 'checkProposedContent',
      'checkAgreement', 'checkObjection', 'isLateAction', 'canTransitionAmendment', 'placeNewSection',
      'CONSTITUTION_LIMITS', 'validateConstitutionText', 'openAmendmentsQuery', 'constitutionQueryShapes',
    ]) {
      expect(constitution, name).toHaveProperty(name);
      expect(domain, name).toHaveProperty(name);
    }
  });

  it('el detector falla ante un import de react, de firebase o un uso de document y window', () => {
    expect(boundaryViolations("import { useState } from 'react';")).toHaveLength(1);
    expect(boundaryViolations("import 'react-dom/client';")).toHaveLength(1);
    expect(boundaryViolations("import { getAuth } from 'firebase/auth';")).toHaveLength(1);
    expect(boundaryViolations("import * as admin from 'firebase-admin';")).toHaveLength(1);
    expect(boundaryViolations("const el = document.getElementById('x');")).toHaveLength(1);
    expect(boundaryViolations('const w = window.innerWidth;')).toHaveLength(1);
  });

  it('el detector deja pasar un módulo puro y las menciones en comentarios', () => {
    expect(boundaryViolations("import { LIMITS } from './limits';")).toEqual([]);
    expect(boundaryViolations('// sin React ni document.getElementById')).toEqual([]);
  });
});
