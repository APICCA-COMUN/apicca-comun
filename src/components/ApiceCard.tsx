// RF-7 (024) · 7.1, D-T10 (024): la tarjeta de un ápice privado lleva la etiqueta «privado».
// RF-5 (024), D-T8 (024): la fecha de la última edición va en forma larga.
// RF-17 (019) · 17.2, D-T11 (019), RF-4 (019) · 4.4: la etapa es la etiqueta de condición dentro del edificio.
// RF-4 (019) · 4.1 a 4.4, D-T19 (019): el edificio crece por etapa. RF-9 (019) · 9.1, 9.2, D-T21 (019): pin y «Tiene necesidades».
// RF-21 (001), RF-22 (001), RNF-2 (001), RF-6 (002), RF-4 (002) · 4.2, RF-7 (002) · 7.2, RF-13 (002) · 13.1, 13.3 · Tarjeta de un ápice en la lista: nombre, edificio, ejes, estado,
// última edición y extracto de la descripción; enlaza a la ficha.
// RF-1 (021) · 1.1, RF-2 (021) · 2.1, 2.4, 2.5, D-T4 (021): el edificio es el dibujo vectorial del ápice, con la variante de su id; la tarjeta no muestra imágenes.
// RF-19 (021) · 19.5, D-T31 (021): mientras se conecta una Acción Común, la casilla «Sumar a la Acción Común» lo suma o lo quita.
// «E3 · Celda» (24-11-2026, Propuesta del asistente): `ApiceCard` es la fila del Ápice en la vista de lista, sin caja: su celda
// hexagonal con la superficie de patrón (56 px) a la izquierda y, a la derecha, el nombre enlazado en mayúsculas, la línea de ejes,
// el rótulo suave «Etapa · Zona XXXX · Editado el …», la descripción recortada a dos líneas y, al conectar, la casilla. Las filas
// se separan con un filete suave (`.c-dato`). El eje y la Etapa se dicen en texto, no solo con el color de la celda.
// Sistema «APICCA · Mapa» (23-11-2026): el Ápice es su superficie de patrón (`Superficie`: el color y el glifo dicen el eje,
// la regla dice la Etapa) y no un dibujo de edificio. `ApiceRow` es su fila corta del panel de Inicio: superficie chica,
// nombre y zona.
import { useId, type ReactNode } from 'react';
import { apiceExcerpt } from '../../shared/domain/discovery';
import { formatLongDate } from '../../shared/domain/dates';
import type { TimestampLike } from '../../shared/domain/order';
import { APICE_STAGE_LABEL, hasNeeds, type ApiceStatus, type Axis, type Visibility } from '../../shared/domain/apice';
import type { Location } from '../../shared/domain/location';
import { Link } from '../app/router';
import { ConditionTag } from './ConditionTag';
import { zoneCode } from './locationText';
import { CeldaSuperficie } from './Celda';
import { EjesLinea } from './EjesLinea';
import { superficieLabel } from './Superficie';
import './ApiceCard.css';

export interface ApiceCardData {
  id: string;
  name: string;
  description: string;
  axes: readonly Axis[];
  status: ApiceStatus;
  updatedAt: TimestampLike;
  needs?: string;
  /** Con `private`, la tarjeta lleva la etiqueta «privado» (RF-7 (024) · 7.1). */
  visibility?: Visibility;
  /** Para el código de zona de la fila. */
  location?: Location | null;
}

interface CardProps {
  apice: ApiceCardData;
  /** Con `onToggle`, la casilla «Sumar a la Acción Común» y si está marcada. */
  chosen?: boolean;
  onToggle?: () => void;
}

export function ApiceCard({ apice, chosen = false, onToggle }: CardProps) {
  const nameId = useId();
  const zone = zoneCode(apice.location);
  const notes = [
    apice.visibility === 'private' ? <ConditionTag key="privado" condition="visibility">privado</ConditionTag> : null,
    hasNeeds(apice.needs) ? <span key="necesidades">Tiene necesidades</span> : null,
  ].filter((note) => note !== null);
  const parts = [
    <ConditionTag key="etapa" condition="status">{APICE_STAGE_LABEL[apice.status]}</ConditionTag>,
    zone === null ? null : <span key="zona">Zona {zone}</span>,
    <span key="editado">Editado el {formatLongDate(apice.updatedAt)}</span>,
  ].filter((part) => part !== null);
  return (
    <article className="c-dato apice-card">
      <span className="apice-card__celda">
        <CeldaSuperficie axes={apice.axes} status={apice.status} ancho={56} grosor={2} />
      </span>
      <div className="apice-card__cuerpo">
        <h3 id={nameId} className="apice-card__nombre">
          <Link href={`/apices/${apice.id}`}>{apice.name}</Link>
        </h3>
        <div role="group" aria-label="Ejes">
          <EjesLinea ejes={apice.axes} />
        </div>
        <p className="c-rot c-suave apice-card__rotulo">{separated(parts)}</p>
        {notes.length > 0 && <p className="c-rot c-suave apice-card__rotulo">{separated(notes)}</p>}
        <p className="c-cuerpo apice-card__descripcion">{apiceExcerpt(apice.description)}</p>
        {onToggle !== undefined && (
          <label className="apice-card__path">
            <input type="checkbox" checked={chosen} aria-describedby={nameId} onChange={onToggle} />
            Sumar a la Acción Común
          </label>
        )}
      </div>
    </article>
  );
}

/** Las partes de un rótulo, con « · » entre ellas (el punto es decoración: no se lee). */
function separated(parts: readonly ReactNode[]): ReactNode[] {
  return parts.flatMap((part, i) => (i === 0 ? [part] : [<span key={`sep${i}`} aria-hidden="true"> · </span>, part]));
}

/** Lo que una fila dice a quien lee con lector de pantalla y no ve la superficie: los ejes, la Etapa y la zona. */
function rowDescription(apice: ApiceCardData): string {
  const zone = zoneCode(apice.location);
  return `${superficieLabel(apice.axes, apice.status)}${zone === null ? '' : `, zona ${zone}`}`;
}

/**
 * La fila del Ápice en la columna de Inicio («E3 · Celda»): `.c-fila` de 26 px con su celda de superficie, el nombre y el
 * código de zona como rótulo suave. Con `dimmed` (lo deja fuera el filtro) la celda se apaga como en el mapa (papel y
 * contorno `trama`) y el nombre baja a suave, pero la fila sigue siendo un enlace y no se quita: filtrar es atenuar.
 */
export function ApiceRow({ apice, current = false, dimmed = false }: { apice: ApiceCardData; current?: boolean; dimmed?: boolean }) {
  const descriptionId = useId();
  const zone = zoneCode(apice.location);
  return (
    <li className="apice-row">
      <Link
        href={`/apices/${apice.id}`}
        className={['c-fila', 'apice-row__link', dimmed ? 'c-fila-off' : null].filter(Boolean).join(' ')}
        aria-describedby={descriptionId}
        aria-current={current ? 'true' : undefined}
      >
        <span className="apice-row__celda" data-off={dimmed ? 'true' : undefined}>
          <CeldaSuperficie axes={apice.axes} status={apice.status} ancho={30} grosor={1.5} />
        </span>
        <span className="c-nm apice-row__name">{apice.name}</span>
        {zone !== null && <span className="c-rot c-suave apice-row__zone">{zone}</span>}
      </Link>
      <span id={descriptionId} className="apice-row__description">
        {rowDescription(apice)}
        {dimmed ? ', fuera del filtro' : ''}
      </span>
    </li>
  );
}
