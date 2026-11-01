// RF-15 (004) · 15.2: las propuestas de la constitución no envían correos. Ninguna op de la constitución,
// ni el cierre, ni el retiro de posturas importa `emailPayload.ts` (T-11.5 (004)).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

const OPS = [
  'saveSection', 'removeSection', 'reorderSections', 'openConstitution', 'saveDocument', 'archiveDocument', 'restoreDocument',
  'openAmendment', 'reviseAmendment', 'withdrawAmendment', 'commentAmendment', 'editComment', 'archiveComment',
  'agreeAmendment', 'revokeAgreement', 'objectAmendment', 'resolveObjection', 'withdrawObjection', 'settleAmendments',
];

const FILES = [
  ...OPS.map((op) => `functions/src/ops/${op}.ts`),
  'functions/src/amendmentStore.ts',
  'functions/src/amendmentCloser.ts',
  'functions/src/withdrawStances.ts',
];

/** Verdadero si el código importa `emailPayload` (estático o dinámico). */
function importsEmail(code: string): boolean {
  return /(?:from|import\()\s*['"][^'"]*emailPayload['"]/.test(code);
}

describe('constitución sin correos', () => {
  it('RF-15 (004) · 15.2: ninguna pieza de la constitución importa emailPayload', () => {
    for (const file of FILES) {
      const path = resolve(root, file);
      expect(existsSync(path), file).toBe(true);
      expect(importsEmail(readFileSync(path, 'utf8')), file).toBe(false);
    }
  });

  it('RF-15 (004) · 15.2: la comprobación detecta un import de emailPayload', () => {
    expect(importsEmail("import { invitationEmail } from './emailPayload';")).toBe(true);
    expect(importsEmail("const m = await import('./ops/emailPayload');")).toBe(true);
    expect(importsEmail("import { settleDue } from './amendmentStore';")).toBe(false);
  });
});
