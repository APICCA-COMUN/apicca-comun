import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentTitleParts } from './documentTitle';
import { usePageTitle } from './usePageTitle';

function description(): string | null {
  return document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;
}

describe('usePageTitle', () => {
  beforeEach(() => {
    document.title = '';
    document.querySelector('meta[name="description"]')?.remove();
  });

  it('en el inicio el título del documento es solo el nombre del sitio', () => {
    renderHook(() => usePageTitle({}));
    expect(document.title).toBe('APICCA COMÚN');
  });

  it('fuera del inicio el título empieza por el área', () => {
    renderHook(() => usePageTitle({ area: 'Ápices' }));
    expect(document.title).toBe('Ápices · APICCA COMÚN');
  });

  it('la descripción del documento es el subtítulo', () => {
    renderHook(() => usePageTitle({}));
    expect(description()).toBe('API para Crear y Conectar Acciones Comunes');
  });

  it('al cambiar las partes cambia el título', () => {
    const { rerender } = renderHook((props: DocumentTitleParts) => usePageTitle(props), {
      initialProps: { area: 'Ápices' } as DocumentTitleParts,
    });
    rerender({ area: 'Ápices', contentTitle: 'Agua' });
    expect(document.title).toBe('Agua · Ápices · APICCA COMÚN');
  });
});
