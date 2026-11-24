// Sistema «APICCA · Mapa»: qué entrada de la navegación principal es la vigente. «Ápices» (`/`) lo es en el inicio y en
// las páginas de un Ápice (ficha, nuevo, editar, historial) y el boceto; las demás, por su ruta (`isCurrentSection`).
// «Acciones Comunes» (`/acciones`) también la pinta el mapa, pero no es «Ápices».
import { isCurrentSection } from '../../shared/domain/navigation';
import { matchRoute, type PageId } from './router';

const APICE_PAGES: ReadonlySet<PageId> = new Set<PageId>(['home', 'apiceView', 'apiceNew', 'apiceEdit', 'apiceHistory', 'sketch']);

export function isCurrentEntry(href: string, path: string): boolean {
  return href === '/' ? APICE_PAGES.has(matchRoute(path).page) : isCurrentSection(href, path);
}
