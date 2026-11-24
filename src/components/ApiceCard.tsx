// RF-7 (024) · 7.1, D-T10 (024): la tarjeta de un ápice privado lleva la etiqueta «privado».
// RF-5 (024), D-T8 (024): la fecha de la última edición va en forma larga.
// RF-17 (019) · 17.2, D-T11 (019), RF-4 (019) · 4.4: la etapa es la etiqueta de condición dentro del edificio.
// RF-4 (019) · 4.1 a 4.4, D-T19 (019): el edificio crece por etapa. RF-9 (019) · 9.1, 9.2, D-T21 (019): pin y «Tiene necesidades».
// RF-21 (001), RF-22 (001), RNF-2 (001), RF-6 (002), RF-4 (002) · 4.2, RF-7 (002) · 7.2, RF-13 (002) · 13.1, 13.3 · Tarjeta de un ápice en la lista: nombre, edificio, ejes, estado,
// última edición y extracto de la descripción; enlaza a la ficha.
// RF-1 (021) · 1.1, RF-2 (021) · 2.1, 2.4, 2.5, D-T4 (021): el edificio es el dibujo vectorial del ápice, con la variante de su id; la tarjeta no muestra imágenes.
// RF-19 (021) · 19.5, D-T31 (021): mientras se conecta una Acción Común, la casilla «Sumar a la Acción Común» lo suma o lo quita.
// Sistema «APICCA · Mapa» (23-11-2026): el Ápice es su superficie de patrón (`Superficie`: el color y el glifo dicen el eje,
// la regla dice la Etapa) y no un dibujo de edificio. `ApiceRow` es su fila corta del panel de Inicio: superficie chica,
// nombre y zona.
import { useId } from 'react';
import { apiceExcerpt } from '../../shared/domain/discovery';
import { formatLongDate } from '../../shared/domain/dates';
import type { TimestampLike } from '../../shared/domain/order';
import { APICE_STAGE_LABEL, hasNeeds, type ApiceStatus, type Axis, type Visibility } from '../../shared/domain/apice';
import type { Location } from '../../shared/domain/location';
import { Link } from '../app/router';
import { AxisBadge } from './AxisIcon';
import { ConditionTag } from './ConditionTag';
import { zoneCode } from './locationText';
import { Superficie, superficieLabel } from './Superficie';
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
  return (
    <article className="block">
      <Superficie axes={apice.axes} status={apice.status} width={240} height={72} fluid />
      <h3 id={nameId}>
        <Link href={`/apices/${apice.id}`}>{apice.name}</Link>
      </h3>
      {onToggle !== undefined && (
        <label className="apice-card__path">
          <input type="checkbox" checked={chosen} aria-describedby={nameId} onChange={onToggle} />
          Sumar a la Acción Común
        </label>
      )}
      <ul aria-label="Ejes" className="apice-card__axes">
        {apice.axes.map((axis) => (
          <li key={axis}>
            <AxisBadge axis={axis} />
          </li>
        ))}
      </ul>
      <p>
        <ConditionTag condition="status">{APICE_STAGE_LABEL[apice.status]}</ConditionTag>
      </p>
      {apice.visibility === 'private' && <ConditionTag condition="visibility">privado</ConditionTag>}
      {hasNeeds(apice.needs) && <p>Tiene necesidades</p>}
      <p>Editado el {formatLongDate(apice.updatedAt)}</p>
      <p>{apiceExcerpt(apice.description)}</p>
    </article>
  );
}

/** Lo que una fila dice a quien lee con lector de pantalla y no ve la superficie: los ejes, la Etapa y la zona. */
function rowDescription(apice: ApiceCardData): string {
  const zone = zoneCode(apice.location);
  return `${superficieLabel(apice.axes, apice.status)}${zone === null ? '' : `, zona ${zone}`}`;
}

/** La fila del Ápice en el panel de Inicio: superficie de 56 × 34, nombre y zona (`FilaApice` del sistema). */
export function ApiceRow({ apice, current = false }: { apice: ApiceCardData; current?: boolean }) {
  const descriptionId = useId();
  const zone = zoneCode(apice.location);
  return (
    <li className="apice-row">
      <Link href={`/apices/${apice.id}`} className="apice-row__link" aria-describedby={descriptionId} aria-current={current ? 'true' : undefined}>
        <Superficie axes={apice.axes} status={apice.status} width={56} height={34} decorative />
        <span className="apice-row__name">{apice.name}</span>
        {zone !== null && <span className="apice-row__zone rotulo">{zone}</span>}
      </Link>
      <span id={descriptionId} className="apice-row__description">
        {rowDescription(apice)}
      </span>
    </li>
  );
}
