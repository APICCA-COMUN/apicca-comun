// Título del documento: lógica pura, sin DOM (la usa `usePageTitle`).
import { SITE_NAME } from '../../shared/domain';

export const SITE_SUBTITLE = 'API para Crear y Conectar Acciones Comunes';

export interface DocumentTitleParts {
  /** Área o sección de la página; en el inicio no hay. */
  area?: string;
  /** Título del contenido concreto que se está viendo. */
  contentTitle?: string;
}

/** `contenido · área · APICCA COMÚN`, omitiendo las partes que falten. */
export function buildDocumentTitle({ area, contentTitle }: DocumentTitleParts): string {
  return [contentTitle, area, SITE_NAME].filter((part): part is string => !!part).join(' · ');
}
