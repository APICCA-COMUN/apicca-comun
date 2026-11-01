import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '../../shared/domain';
import { buildDocumentTitle } from './documentTitle';

describe('buildDocumentTitle', () => {
  it('en el inicio es solo el nombre del sitio', () => {
    expect(buildDocumentTitle({})).toBe(SITE_NAME);
  });

  it('fuera del inicio empieza por el área', () => {
    expect(buildDocumentTitle({ area: 'Ápices' })).toBe('Ápices · APICCA COMÚN');
  });

  it('un contenido concreto antepone su título al área', () => {
    expect(buildDocumentTitle({ area: 'Ápices', contentTitle: 'Agua' })).toBe('Agua · Ápices · APICCA COMÚN');
  });

  it('ignora partes vacías', () => {
    expect(buildDocumentTitle({ area: '', contentTitle: '' })).toBe(SITE_NAME);
  });
});
