// Título y descripción del documento: cada página llama a `usePageTitle({ area, contentTitle })`;
// el título lo compone `buildDocumentTitle` y la descripción es siempre el subtítulo del sitio.
import { useEffect } from 'react';
import { buildDocumentTitle, SITE_SUBTITLE, type DocumentTitleParts } from './documentTitle';

function setDescription(content: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function usePageTitle({ area, contentTitle }: DocumentTitleParts): void {
  useEffect(() => {
    document.title = buildDocumentTitle({
      ...(area === undefined ? {} : { area }),
      ...(contentTitle === undefined ? {} : { contentTitle }),
    });
    setDescription(SITE_SUBTITLE);
  }, [area, contentTitle]);
}
