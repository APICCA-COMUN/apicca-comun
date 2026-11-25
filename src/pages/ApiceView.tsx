// RF-22 (001), RF-9 (001), RF-13 (001), RF-14 (001), RF-12 (003) · 12.1, 12.5, RF-18 (019) · 18.1, D-T12 (019), RF-17 (019) · 17.2,
// RF-27 (021) · 27.1, D-T5 (021), RF-14 (021) · 14.3 (el enlace «Editar») · Ficha de un ápice: sin imágenes, generación ni referencias;
// todos sus datos con marcadores donde falta algo, y los controles de visibilidad y archivo para quien puede usarlos. Un
// ápice que la persona no puede ver se muestra igual que uno inexistente, para no revelar que existe. El título de la
// página es h1.
// «E3 · Celda» (24-11-2026, Propuesta del asistente): la ficha va en el panel de Inicio sin caja ni superficie propia, con las
// piezas del sistema. GamePanel pone la línea de sección «Ápice» con «Cerrar»; aquí van el rótulo suave «Zona 0828 · etapa»
// (sin zona, solo la etapa), el nombre (`.c-nombre`, el h1), la línea de ejes (celda pequeña de color + nombre en minúscula),
// un hueco opcional, `ampliacion`, donde la página pone la celda grande con su línea de llamada, la descripción, los datos
// (`.c-dato`: Ofrece, Necesita, Ubicación, Autoría y, si las hay, las Acciones Comunes del Ápice) y las acciones, que son
// enlaces de texto (`.c-enlace`).
import { useEffect, useState, type ReactNode } from 'react';
import { canArchive, canChangeVisibility, canEdit, canView, type ApiceViewer } from '../../shared/domain/access';
import { formatLongDate } from '../../shared/domain/dates';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreApiceSource, type ApiceDoc, type ApiceSource } from '../data/apices';
import { ArchiveControls } from '../components/ArchiveControls';
import { EjesLinea } from '../components/EjesLinea';
import { Icono } from '../components/Glifo';
import { describeLocation, zoneCode } from '../components/locationText';
import { VisibilityControl } from '../components/VisibilityControl';
import './ApiceView.css';

/** Una Acción Común que une al Ápice, para su dato «Acción Común». */
export interface AccionDelApice {
  id: string;
  title: string;
}

interface Props {
  id: string;
  source?: ApiceSource;
  client?: OpClient<ApiOps>;
  /** Lo que va tras la línea de ejes: la página pone ahí la celda grande del Ápice, junto a su llamada. */
  ampliacion?: ReactNode;
  /** Las Acciones Comunes que unen a este Ápice; sin ellas (o vacío), no hay dato. */
  acciones?: readonly AccionDelApice[];
}

export function ApiceView({ id, source = firestoreApiceSource, client = api, ampliacion, acciones = [] }: Props) {
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
    <article className="apice-view">
      <header className="apice-view__head">
        <p className="apice-view__rotulo c-rot c-suave">
          {zone === null ? '' : `Zona ${zone} · `}
          {apice.status}
        </p>
        <h1 className="c-nombre">{apice.name}</h1>
        <EjesLinea ejes={apice.axes} />
      </header>
      {ampliacion}
      <p className="c-cuerpo apice-view__descripcion">{apice.description}</p>
      <div className="apice-view__datos">
        <div className="c-dato">
          <Icono name="ofrece" />
          <span className="c-rot">Ofrece</span>
          <span className={apice.offers === '' ? 'c-cuerpo c-suave' : 'c-cuerpo'}>{apice.offers === '' ? 'Sin declarar.' : apice.offers}</span>
        </div>
        <div className="c-dato">
          <Icono name="necesita" />
          <span className="c-rot">Necesita</span>
          <span className={apice.needs === '' ? 'c-cuerpo c-suave' : 'c-cuerpo'}>{apice.needs === '' ? 'Sin declarar.' : apice.needs}</span>
        </div>
        <div className="c-dato">
          <h2 className="c-rot">Ubicación</h2>
          <p className="c-cuerpo">{describeLocation(apice.location)}</p>
        </div>
        <div className="c-dato">
          <span className="c-rot">Autoría</span>
          <p className="c-cuerpo">
            Creado por {apice.authorUsername ?? 'una persona de la comunidad'}
            {apice.updatedAt === undefined ? '' : ` · Última edición el ${formatLongDate(apice.updatedAt)}`}
            {apice.lastEditedByUsername === undefined ? '' : ` por ${apice.lastEditedByUsername}`}
          </p>
        </div>
        {acciones.length > 0 && (
          <div className="c-dato c-dato--columna">
            <span className="c-rot">Acción Común</span>
            <ul className="apice-view__acciones" aria-label="Acciones Comunes del Ápice">
              {acciones.map((accion) => (
                <li key={accion.id}>
                  <Link href={`/acciones/${accion.id}`} className="apice-view__accion">
                    {accion.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="apice-view__enlaces">
        {canEdit(viewer, apice) ? (
          <Link href={`/apices/${apice.id}/editar`} className="c-enlace action-secondary">
            Editar
          </Link>
        ) : null}
        {session.status === 'person' ? (
          <Link href={`/apices/${apice.id}/historial`} className="c-enlace">
            Historial
          </Link>
        ) : null}
      </div>
      {canChangeVisibility(viewer, apice) ? <VisibilityControl id={apice.id} visibility={apice.visibility} client={client} /> : null}
      {canArchive(viewer, apice) ? <ArchiveControls id={apice.id} isArchived={apice.isArchived} client={client} /> : null}
    </article>
  );
}
