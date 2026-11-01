// RF-1 (012), RF-2 (012), RF-3 (012) · Lectura de los avisos de Mi tablero: los de ápices (`notices/{uid}/items`), los de la
// constitución (derivados de `amendments`, D-T4 (012)) y la marca de lectura de la cuenta. La fuente se recibe por props.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, type Firestore } from 'firebase/firestore';
import { mergeNotices, NOTICE_LIMIT, visibleNotices, type Notice, type NoticeType } from '../../shared/domain/notices';
import { toMs } from './constitution/read';
import { firebase } from './firebase';

export interface NoticesData {
  notices: Notice[];
  /** Marca de lectura en milisegundos; `null` si nunca marcó. */
  seenAt: number | null;
}

export interface NoticesSource {
  fetchNotices(uid: string): Promise<NoticesData>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function createNoticesSource(db: Firestore, now: () => number = Date.now): NoticesSource {
  return {
    async fetchNotices(uid) {
      const [items, opened, closed, account] = await Promise.all([
        getDocs(query(collection(db, 'notices', uid, 'items'), orderBy('createdAt', 'desc'), limit(NOTICE_LIMIT))),
        getDocs(query(collection(db, 'amendments'), orderBy('openedAt', 'desc'), limit(NOTICE_LIMIT))),
        getDocs(query(collection(db, 'amendments'), orderBy('closedAt', 'desc'), limit(NOTICE_LIMIT))),
        getDoc(doc(db, 'accounts', uid)),
      ]);
      const fromApices: Notice[] = items.docs.flatMap((d) => {
        const data = d.data();
        const at = toMs(data['createdAt']);
        if (at === null) return [];
        return [{ id: d.id, type: str(data['type']) as NoticeType, at, href: `/apices/${str(data['apiceId'])}`, actor: str(data['actorUsername']), subject: str(data['apiceName']) }];
      });
      const fromAmendment = (type: NoticeType, prefix: string, field: string) =>
        (d: { id: string; data(): Record<string, unknown> }): Notice[] => {
          const data = d.data();
          const at = toMs(data[field]);
          if (at === null) return [];
          return [{ id: `${prefix}${d.id}`, type, at, href: `/constitucion/propuestas/${d.id}`, actor: str(data['authorUsername']), subject: str(data['title']) }];
        };
      const fromConstitution = [
        ...opened.docs.flatMap(fromAmendment('constitucion-abierta', 'am-open-', 'openedAt')),
        ...closed.docs.flatMap(fromAmendment('constitucion-resuelta', 'am-closed-', 'closedAt')),
      ];
      return {
        notices: visibleNotices(mergeNotices(fromApices, fromConstitution), now()),
        seenAt: toMs(account.data()?.['noticesSeenAt']),
      };
    },
  };
}

export const firestoreNoticesSource: NoticesSource = {
  fetchNotices: (uid) => createNoticesSource(firebase().db).fetchNotices(uid),
};
