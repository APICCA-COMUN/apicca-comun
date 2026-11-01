// Spec 012 · Avisos de Mi tablero: unión, orden, recorte y conteo. Dominio puro, sin React, DOM ni Firebase (RNF-1 (012)).

export type NoticeType = 'apice-editado' | 'apice-archivado' | 'constitucion-abierta' | 'constitucion-resuelta';

export interface Notice {
  id: string;
  type: NoticeType;
  /** Instante en milisegundos desde la época. */
  at: number;
  /** Ruta interna a la que lleva el aviso. */
  href: string;
  /** Nombre de usuario de quien actuó o propuso. */
  actor: string;
  /** Nombre del ápice o título de la sección. */
  subject: string;
}

/** RF-4 (012) · 4.3: máximo de avisos que muestra el panel. */
export const NOTICE_LIMIT = 20;
/** RNF-4 (012), D-5 (012): días que un aviso se muestra. */
export const NOTICE_RETENTION_DAYS = 90;
const DAY_MS = 24 * 3600 * 1000;
const MAX_COUNT = 99;

/** Une las fuentes sin repetir ids, del más reciente al más antiguo. */
export function mergeNotices(...sources: readonly (readonly Notice[])[]): Notice[] {
  const byId = new Map<string, Notice>();
  for (const source of sources) for (const item of source) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.at - a.at);
}

/** Avisos de los últimos 90 días, hasta 20 (RNF-4 (012), RF-4 (012) · 4.3). */
export function visibleNotices(notices: readonly Notice[], now: number): Notice[] {
  const since = now - NOTICE_RETENTION_DAYS * DAY_MS;
  return notices.filter((n) => n.at >= since).slice(0, NOTICE_LIMIT);
}

/** Avisos posteriores a la marca de lectura (RF-3 (012)); sin marca, todos. */
export function unreadCount(notices: readonly Notice[], seenAt: number | null): number {
  return seenAt === null ? notices.length : notices.filter((n) => n.at > seenAt).length;
}

/** RF-4 (012) · 4.4: número visible junto a la campana; vacío con cero. */
export function countLabel(count: number): string {
  if (count <= 0) return '';
  return count > MAX_COUNT ? `${MAX_COUNT}+` : String(count);
}

/** RF-4 (012) · 4.1: nombre accesible de la campana. */
export function bellLabel(count: number): string {
  return count <= 0 ? 'Avisos: no tienes avisos sin leer' : `Avisos: tienes ${countLabel(count)} sin leer`;
}

/** Texto corto de cada aviso. */
export function noticeText(n: Notice): string {
  switch (n.type) {
    case 'apice-editado':
      return `@${n.actor} editó «${n.subject}»`;
    case 'apice-archivado':
      return `@${n.actor} archivó «${n.subject}»`;
    case 'constitucion-abierta':
      return `Propuesta de cambio abierta por @${n.actor}: «${n.subject}»`;
    case 'constitucion-resuelta':
      return `Se resolvió la propuesta de @${n.actor}: «${n.subject}»`;
  }
}
