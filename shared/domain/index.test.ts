import { describe, expect, it } from 'vitest';
import * as dominio from './index';
import { SITE_NAME } from './index';

describe('shared/domain', () => {
  it('el dominio expone el nombre exacto del sitio', () => {
    expect(SITE_NAME).toBe('APICCA COMÚN');
  });

  it('el índice re-exporta los módulos genéricos', () => {
    for (const name of ['todayInColombia', 'validateLength', 'compareTimestamps', 'parseText', 'validateUrl']) {
      expect(typeof (dominio as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it('la prueba de dominio corre en Node, sin DOM', () => {
    expect(typeof globalThis.document).toBe('undefined');
  });
});
