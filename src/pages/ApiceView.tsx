// RF-22 (001), RF-9 (001), RF-13 (001), RF-14 (001), RF-12 (003) · 12.1, 12.5, RF-6 (002) · 6.1, RF-4 (002) · 4.2, RF-7 (002) · 7.2, RF-13 (002) · 13.1, 13.3,
// RF-18 (019) · 18.1, D-T12 (019), RF-17 (019) · 17.2, D-T11 (019), RF-11 (019) · 11.1 a 11.4, D-T23 (019),
// RF-1 (021) · 1.1, RF-2 (021) · 2.1, 2.4, RF-27 (021) · 27.1, D-T5 (021), RF-14 (021) · 14.3 (el enlace «Editar») · Ficha de un ápice: su edificio vectorial, sin imágenes, generación ni referencias; todos sus datos con marcadores donde falta algo,
// y los controles de visibilidad y archivo para quien puede usarlos. Un ápice que la persona no puede ver se
// muestra igual que uno inexistente, para no revelar que existe. El título de la página es h1.
import { useEffect, useState } from 'react';
import { canArchive, canChangeVisibility, canEdit, canView, type ApiceViewer } from '../../shared/domain/access';
import { hasNeeds } from '../../shared/domain/apice';
import { formatLongDate } from '../../shared/domain/dates';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreApiceSource, type ApiceDoc, type ApiceSource } from '../data/apices';
import { ArchiveControls } from '../components/ArchiveControls';
import { AxisBadge } from '../components/AxisIcon';
import { Building } from '../components/Building';
import { describeLocation } from '../components/locationText';
import { VisibilityControl } from '../components/VisibilityControl';
import './ApiceView.css';

interface Props {
  id: string;
  source?: ApiceSource;
  client?: OpClient<ApiOps>;
}

export function ApiceView({ id, source = firestoreApiceSource, client = api }: Props) {
  const session = useSession();
  const [apice, setApice] = useState<ApiceDoc | null | undefined>(undefined);
  useEffect(() => source.onApice(id, setApice), [source, id]);
  usePageTitle({ area: 'Ápices', contentTitle: apice?.name ?? 'Ápice' });

  if (session.status === 'loading' || apice === undefined) return <p>Cargando…</p>;

  const viewer: ApiceViewer | null = session.status === 'person' ? { uid: session.uid, role: session.role, status: 'active' } : null;
  if (apice === null || !canView(viewer, apice)) {
    return (
      <section>
        <h1>Ápice</h1>
        <p>No se encontró el ápice.</p>
      </section>
    );
  }

  return (
    <article className="lot apice-view">
      <header className="apice-view__head">
        <Building axes={apice.axes} stage={apice.status} seed={apice.id} needs={hasNeeds(apice.needs)} max={4} />
        <h1>{apice.name}</h1>
      </header>
      <p>{apice.description}</p>
      <ul className="apice-view__axes" aria-label="Ejes">
        {apice.axes.map((axis) => (
          <li key={axis}>
            <AxisBadge axis={axis} />
          </li>
        ))}
      </ul>
      <div className="apice-view__workshop">
        <section className="lot">
          <h2>Necesidades</h2>
          <p>{apice.needs === '' ? 'Aún no se han escrito necesidades.' : apice.needs}</p>
        </section>
        <section className="lot">
          <h2>Aportes</h2>
          <p>{apice.offers === '' ? 'Aún no se han escrito aportes.' : apice.offers}</p>
        </section>
      </div>
      <h2>Ubicación</h2>
      <p>{describeLocation(apice.location)}</p>
      <p>
        Creado por {apice.authorUsername ?? 'una persona de la comunidad'}
        {apice.updatedAt === undefined ? '' : ` · Última edición el ${formatLongDate(apice.updatedAt)}`}
        {apice.lastEditedByUsername === undefined ? '' : ` por ${apice.lastEditedByUsername}`}
      </p>
      {canEdit(viewer, apice) ? (
        <p>
          <Link href={`/apices/${apice.id}/editar`} className="block action-secondary">
            Editar
          </Link>
        </p>
      ) : null}
      {session.status === 'person' ? <Link href={`/apices/${apice.id}/historial`}>Historial</Link> : null}
      {canChangeVisibility(viewer, apice) ? <VisibilityControl id={apice.id} visibility={apice.visibility} client={client} /> : null}
      {canArchive(viewer, apice) ? <ArchiveControls id={apice.id} isArchived={apice.isArchived} client={client} /> : null}
    </article>
  );
}
