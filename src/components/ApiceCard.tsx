// RF-17 (019) · 17.2, D-T11 (019), RF-4 (019) · 4.4: la etapa es la etiqueta de condición dentro del edificio.
// RF-4 (019) · 4.1 a 4.4, D-T19 (019): el edificio crece por etapa. RF-9 (019) · 9.1, 9.2, D-T21 (019): pin y «Tiene necesidades».
// RF-21 (001), RF-22 (001), RNF-2 (001), RF-6 (002), RF-4 (002) · 4.2, RF-7 (002) · 7.1, 7.2, RF-13 (002) · 13.1, 13.3 · Tarjeta de un ápice en la lista: nombre, imagen, ejes, estado,
// última edición y extracto de la descripción; enlaza a la ficha.
import { apiceExcerpt } from '../../shared/domain/discovery';
import type { TimestampLike } from '../../shared/domain/order';
import { hasNeeds, type ApiceStatus, type Axis } from '../../shared/domain/apice';
import { Link } from '../app/router';
import type { ApiceImage } from '../data/apices';
import { AxisBadge } from './AxisIcon';
import { Building } from './Building';

export interface ApiceCardData {
  id: string;
  name: string;
  description: string;
  axes: readonly Axis[];
  status: ApiceStatus;
  updatedAt: TimestampLike;
  image: ApiceImage | null;
  needs?: string;
}

/** Fecha de una edición, en hora de Colombia. */
export function formatDate(at: TimestampLike): string {
  return new Date(at.seconds * 1000).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium' });
}

export function ApiceCard({ apice }: { apice: ApiceCardData }) {
  return (
    <article className="block">
      <Building image={apice.image} axes={apice.axes} stage={apice.status} needs={hasNeeds(apice.needs)} max={2} />
      <h3>
        <Link href={`/apices/${apice.id}`}>{apice.name}</Link>
      </h3>
      <ul aria-label="Ejes">
        {apice.axes.map((axis) => (
          <li key={axis}>
            <AxisBadge axis={axis} />
          </li>
        ))}
      </ul>
      {hasNeeds(apice.needs) && <p>Tiene necesidades</p>}
      <p>Editado el {formatDate(apice.updatedAt)}</p>
      <p>{apiceExcerpt(apice.description)}</p>
    </article>
  );
}
