// RF-5 (004) · 5.1, 5.2, 5.4 · Lectura de los documentos de la constitución: lista de 20 en 20 de no archivados (o,
// para quien facilita, de archivados), un documento y sus versiones. Las reglas deciden quién lee qué (RF-5 (004) · 5.2,
// D-T15 (004)); la fuente se recibe por props para probarse con dobles.
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { documentsQuery } from '../../../shared/domain/constitution';
import { apiceExcerpt } from '../../../shared/domain/discovery';
import { inlineText, parseMarkdown } from '../../../shared/domain/docs/markdown';
import { firebase } from '../firebase';
import { bool, msOr, num, text, type DocLike, type Unsubscribe } from './read';

export type { Unsubscribe } from './read';

/** Lo que muestra cada fila de la lista: sin el texto completo. */
export interface ListedDocument {
  id: string;
  title: string;
  /** Primeros 200 caracteres del texto, sin formato (RF-5 (004) · 5.1). */
  excerpt: string;
  updatedAt: number;
  version: number;
}

export interface DocumentDoc {
  id: string;
  title: string;
  text: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
}

export interface DocumentVersion {
  version: number;
  title: string;
  text: string;
  byUid: string;
  byUsername: string;
  at: number;
}

/** Marca opaca de dónde seguir; `null` en una tanda dice que no hay más. */
export type DocumentCursor = QueryDocumentSnapshot;

export interface DocumentPage {
  items: ListedDocument[];
  cursor: DocumentCursor | null;
}

export interface DocumentsSource {
  /** `archived: true` solo lo deja leer a quien facilita (RF-5 (004) · 5.7). */
  fetchPage(request: { archived: boolean; cursor?: DocumentCursor | null }): Promise<DocumentPage>;
  /** `null` si no existe o si las reglas no dejan leerlo. */
  onDocument(id: string, callback: (document: DocumentDoc | null) => void): Unsubscribe;
  /** Solo cuentas activas (RF-5 (004) · 5.4); de la versión más reciente a la primera. */
  onVersions(id: string, callback: (versions: DocumentVersion[]) => void, onError?: () => void): Unsubscribe;
}

/** Texto plano del Markdown del documento: sin marcas, encabezados ni enlaces. Si no se entiende, quita las marcas sueltas. */
export function plainText(markdown: string): string {
  try {
    return parseMarkdown(markdown)
      .map((block) => {
        if (block.type === 'code') return block.text;
        if (block.type === 'list') return block.items.map((item) => inlineText(item.children)).join(' ');
        return inlineText(block.children);
      })
      .join(' ');
  } catch {
    return markdown.replace(/```/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^\s*(?:#{1,6}|>|[-+]|\d+\.)\s+/gm, '').replace(/[*_`]+/g, '');
  }
}

/** Primeros 200 puntos de código del texto sin formato, con los espacios reducidos. */
export function documentExcerpt(markdown: string): string {
  return apiceExcerpt(plainText(markdown));
}

function readDocument(row: DocLike): DocumentDoc {
  const data = row.data() ?? {};
  return {
    id: row.id,
    title: text(data['title']),
    text: text(data['text']),
    version: num(data['version']),
    createdAt: msOr(data['createdAt']),
    updatedAt: msOr(data['updatedAt']),
    isArchived: bool(data['isArchived']),
  };
}

function readVersion(row: DocLike): DocumentVersion {
  const data = row.data() ?? {};
  return {
    version: num(data['version'], Number(row.id)),
    title: text(data['title']),
    text: text(data['text']),
    byUid: text(data['byUid']),
    byUsername: text(data['byUsername']),
    at: msOr(data['at']),
  };
}

/** Consulta por cursor: pide una más que la tanda para saber si queda otra sin leer de más. */
export function createDocumentsSource(db: Firestore): DocumentsSource {
  return {
    async fetchPage({ archived, cursor }) {
      const shape = documentsQuery({ archived });
      const constraints = [
        ...shape.conditions.map((c) => where(c.field, c.op, c.value)),
        orderBy(shape.orderBy.field, shape.orderBy.direction),
        ...(cursor ? [startAfter(cursor)] : []),
      ];
      const size = shape.limit ?? 20;
      const snapshot = await getDocs(query(collection(db, shape.collection), ...constraints, limit(size + 1)));
      const hasMore = snapshot.docs.length > size;
      const docs = snapshot.docs.slice(0, size);
      return {
        items: docs.map((d) => {
          const full = readDocument(d);
          return { id: full.id, title: full.title, excerpt: documentExcerpt(full.text), updatedAt: full.updatedAt, version: full.version };
        }),
        cursor: hasMore ? (docs[docs.length - 1] ?? null) : null,
      };
    },
    onDocument: (id, callback) =>
      onSnapshot(
        doc(db, 'constitutionDocuments', id),
        (s) => callback(s.exists() ? readDocument({ id: s.id, data: () => s.data() }) : null),
        () => callback(null),
      ),
    onVersions: (id, callback, onError) =>
      onSnapshot(
        query(collection(db, 'constitutionDocuments', id, 'versions'), orderBy('version', 'desc')),
        (s) => callback(s.docs.map(readVersion)),
        () => onError?.(),
      ),
  };
}

export const firestoreDocumentsSource: DocumentsSource = {
  fetchPage: (request) => createDocumentsSource(firebase().db).fetchPage(request),
  onDocument: (id, cb) => createDocumentsSource(firebase().db).onDocument(id, cb),
  onVersions: (id, cb, err) => createDocumentsSource(firebase().db).onVersions(id, cb, err),
};
