// RF-22 (001), RF-9 (001), RF-13 (001), RF-14 (001), RF-12 (003) · 12.1, 12.5, RF-18 (019) · 18.1, D-T12 (019), RF-17 (019) · 17.2,
// RF-27 (021) · 27.1, D-T5 (021), RF-14 (021) · 14.3 (el enlace «Editar») · Ficha de un ápice: sin imágenes, generación ni referencias;
// todos sus datos con marcadores donde falta algo, y los controles de visibilidad y archivo para quien puede usarlos. Un
// ápice que la persona no puede ver se muestra igual que uno inexistente, para no revelar que existe. El título de la
// página es h1.
// Sistema «APICCA · Mapa» (23-11-2026): la ficha lleva la superficie del Ápice arriba, a todo el ancho, y debajo el
// cuerpo con el título, el rótulo «agua · en marcha · zona …» (que ya nombra los ejes, así que no hay insignias aparte) y lo
// que ofrece y necesita, una línea cada uno (`.ap-dato`: ícono, etiqueta en 800 y el dato).
import { useEffect, useState } from 'react';
import { canArchive, canChangeVisibility, canEdit, canView, type ApiceViewer } from '../../shared/domain/access';
import { formatLongDate } from '../../shared/domain/dates';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreApiceSource, type ApiceDoc, type ApiceSource } from '../data/apices';
import { ArchiveControls } from '../components/ArchiveControls';
import { Icono } from '../components/Glifo';
import { describeLocation, zoneCode } from '../components/locationText';
import { Superficie, axesText } from '../components/Superficie';
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

  const zone = zoneCode(apice.location);
  return (
    <article className="lot apice-view">
      <Superficie axes={apice.axes} status={apice.status} width={430} height={112} fluid outline={false} />
      <div className="apice-view__body">
        <header className="apice-view__head">
          <h1>{apice.name}</h1>
          <p className="apice-view__rotulo">
            {axesText(apice.axes)} · {apice.status}
            {zone === null ? '' : ` · zona ${zone}`}
          </p>
        </header>
        <p>{apice.description}</p>
        <div className="apice-view__datos">
          <p className="apice-view__dato">
            <Icono name="ofrece" />
            <strong>Ofrece:</strong>
            <span>{apice.offers === '' ? 'Sin declarar.' : apice.offers}</span>
          </p>
          <p className="apice-view__dato">
            <Icono name="necesita" />
            <strong>Necesita:</strong>
            <span>{apice.needs === '' ? 'Sin declarar.' : apice.needs}</span>
          </p>
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
      </div>
    </article>
  );
}
