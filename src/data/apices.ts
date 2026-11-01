// RF-10 (001) · Lectura de un ápice para editarlo. Las reglas de Firestore deciden si la cuenta lo puede ver
// (RNF-4 (001)); la página recibe la fuente por props para probarse con dobles.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Axis, Visibility } from '../../shared/domain/apice';
import type { ApiceAccessState } from '../../shared/domain/access';
import type { ApiceStatus } from '../../shared/domain/apice';
import { listQueryShape, type ListAudience, type ListFilters } from '../../shared/domain/discovery';
import type { TimestampLike } from '../../shared/domain/order';
import { DEFAULT_PRECISION, validateCoordinates, type Location, type Point } from '../../shared/domain/location';
import type { EditableFields } from '../../shared/domain/versions';
import { firebase } from './firebase';

/** Imagen aceptada de un ápice: PNG de paleta guardado en el propio documento (D-T6 (001)). */
export interface ApiceImage {
  altText: string;
  png: Uint8Array;
}

/** Lo que la edición y la ficha necesitan del ápice: contenido, versión, acceso y los datos de pantalla. */
export interface ApiceDoc extends EditableFields, ApiceAccessState {
  id: string;
  version: number;
  authorUsername?: string | undefined;
  lastEditedByUsername?: string | undefined;
  updatedAt?: TimestampLike | undefined;
  image?: ApiceImage | null;
  /** Ubicación de pantalla (zona o punto, según la precisión); `null` o ausente se muestra como marcador vacío. */
  location?: Location | null;
}

export type Unsubscribe = () => void;

export interface ApiceSource {
  /** `null` si no existe o si las reglas no dejan leerlo. */
  onApice(id: string, callback: (apice: ApiceDoc | null) => void): Unsubscribe;
  /**
   * Punto exacto de una versión (`versions/{n}/private/exact`). Solo lo dejan leer las reglas a la autora y
   * a la facilitación (RF-9 (001)); `null` si no hay o no se puede leer.
   */
  readExact?(id: string, version: number): Promise<Point | null>;
}

function readLocation(raw: unknown): Location | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { lat, lng, precision } = raw as Record<string, unknown>;
  const point = validateCoordinates(lat, lng);
  if (!point.ok) return null;
  return { ...point.value, precision: precision === 'exact' ? 'exact' : DEFAULT_PRECISION };
}

function readImage(raw: unknown): ApiceImage | null {
  if (raw === null || raw === undefined) return null;
  const image = raw as { altText: string; png: { toUint8Array(): Uint8Array } };
  return { altText: image.altText, png: image.png.toUint8Array() };
}

/** Fuente real: escucha el ápice con Firestore. */
export const firestoreApiceSource: ApiceSource = {
  onApice: (id, callback) =>
    onSnapshot(
      doc(firebase().db, 'apices', id),
      (snapshot) => {
        const data = snapshot.data();
        callback(
          data === undefined
            ? null
            : {
                id: snapshot.id,
                version: data['version'] as number,
                name: data['name'] as string,
                description: data['description'] as string,
                axes: data['axes'] as Axis[],
                needs: data['needs'] as string,
                offers: data['offers'] as string,
                status: data['status'] as EditableFields['status'],
                visibility: data['visibility'] as Visibility,
                isArchived: data['isArchived'] as boolean,
                authorUid: data['authorUid'] as string,
                authorUsername: data['authorUsername'] as string | undefined,
                lastEditedByUsername: data['lastEditedByUsername'] as string | undefined,
                updatedAt: data['updatedAt'] as TimestampLike | undefined,
                image: readImage(data['image']),
                location: readLocation(data['location']),
              },
        );
      },
      () => callback(null),
    ),
  async readExact(id, version) {
    try {
      const snapshot = await getDoc(doc(firebase().db, 'apices', id, 'versions', String(version), 'private', 'exact'));
      const point = validateCoordinates(snapshot.data()?.['lat'], snapshot.data()?.['lng']);
      return point.ok ? point.value : null;
    } catch {
      // Sin permiso (o sin red) el punto exacto simplemente no se muestra.
      return null;
    }
  },
};

/** Lo que la lista necesita de cada ápice. */
export interface ListedApice {
  id: string;
  name: string;
  description: string;
  axes: Axis[];
  status: ApiceStatus;
  updatedAt: TimestampLike;
  image: ApiceImage | null;
  /** Ubicación de pantalla para el mapa del inicio; `null` o ausente: no aparece en el mapa. */
  location?: Location | null;
}

/** Marca opaca de dónde seguir; `null` en una tanda dice que no hay más. */
export type ListCursor = QueryDocumentSnapshot;

export interface ListRequest {
  audience: ListAudience;
  filters: ListFilters;
  /** Obligatorio con `archived-own`. */
  uid?: string;
  /** Cursor de la tanda anterior; sin él, la primera tanda. */
  cursor?: ListCursor | null;
}

export interface ListPage {
  items: ListedApice[];
  cursor: ListCursor | null;
}

export interface ListSource {
  fetchPage(request: ListRequest): Promise<ListPage>;
}

/** Consulta por cursor: pide una más que la tanda para saber si queda otra sin leer de más. */
export function createListSource(db: Firestore): ListSource {
  return {
    async fetchPage({ audience, filters, uid, cursor }) {
      const shape = listQueryShape({ audience, filters, ...(uid === undefined ? {} : { uid }) });
      const constraints = shape.conditions.map((c) => where(c.field, c.op, c.value));
      const ordered: QueryConstraint[] = [...constraints, orderBy(shape.orderBy.field, shape.orderBy.direction)];
      if (cursor) ordered.push(startAfter(cursor));
      const snapshot = await getDocs(query(collection(db, shape.collection), ...ordered, limit(shape.limit + 1)));
      const hasMore = snapshot.docs.length > shape.limit;
      const docs = snapshot.docs.slice(0, shape.limit);
      return {
        items: docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data['name'] as string,
            description: data['description'] as string,
            axes: data['axes'] as Axis[],
            status: data['status'] as ApiceStatus,
            updatedAt: data['updatedAt'] as TimestampLike,
            image: readImage(data['image']),
            location: readLocation(data['location']),
          };
        }),
        cursor: hasMore ? (docs[docs.length - 1] ?? null) : null,
      };
    },
  };
}

/** Fuente real de la lista. */
export const firestoreListSource: ListSource = {
  fetchPage: (request) => createListSource(firebase().db).fetchPage(request),
};
