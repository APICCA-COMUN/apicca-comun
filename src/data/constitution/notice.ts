// RF-15 (004) · 15.1 · Datos del aviso de propuestas abiertas: cuántas hay (`count()`) y el menor `closesAt`. Solo la
// cuenta activa lo lee (RF-9 (004) · 9.4); al visitante no se le pide nada. La fuente se recibe por props.
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { openAmendmentsQuery } from '../../../shared/domain/constitution';
import { firebase } from '../firebase';
import { toMs, type ReaderAudience } from './read';

export interface AmendmentNotice {
  /** Propuestas abiertas; con 0 no hay aviso. */
  count: number;
  /** Cierre más próximo en milisegundos; `null` si no hay abiertas. */
  nextCloseAt: number | null;
}

export const NO_NOTICE: AmendmentNotice = { count: 0, nextCloseAt: null };

export interface NoticeSource {
  fetchNotice(audience: ReaderAudience): Promise<AmendmentNotice>;
}

export function createNoticeSource(db: Firestore): NoticeSource {
  return {
    async fetchNotice(audience) {
      if (audience === 'visitor') return NO_NOTICE;
      const shape = openAmendmentsQuery();
      const conditions = shape.conditions.map((c) => where(c.field, c.op, c.value));
      const counted = await getCountFromServer(query(collection(db, shape.collection), ...conditions));
      const count = counted.data().count;
      if (count === 0) return NO_NOTICE;
      const nearest = await getDocs(query(collection(db, shape.collection), ...conditions, orderBy(shape.orderBy.field, shape.orderBy.direction), limit(1)));
      return { count, nextCloseAt: toMs(nearest.docs[0]?.data()['closesAt']) };
    },
  };
}

export const firestoreNoticeSource: NoticeSource = {
  fetchNotice: (audience) => createNoticeSource(firebase().db).fetchNotice(audience),
};
