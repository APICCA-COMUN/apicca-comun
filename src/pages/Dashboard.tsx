// RF-4 (012) · campana de avisos en la fila del saludo.
// RF-8 (008) · 8.1–8.8, D-10 (008) (en `Dashboard.css`), RF-11 (003) · 11.1–11.7, 11.9, 11.10, RF-4 (003) · 4.9, D-T13 (003); RF-15 (004) · 15.1 · Mi tablero (`/tablero`): saludo, rol, «Nuevo ápice»,
// mapa y lista de los ápices propios, «Archivados», «Cerrar sesión», aviso de propuestas abiertas (RF-15 (004) · 15.1) y, para quien facilita, el enlace a Facilitación.
// RF-9 (005) · 9.1, 9.2, RF-7 (005) · 7.8, 7.11, D-8 (005): «Mis ápices» con el lote ilustrado y su panel encima del mapa y la
// lista; «Nuevo ápice» lleva un «+» decorativo y pasa a secundario mientras se ve la edición rápida.
import { useEffect, useState } from "react";
import { NO_FILTERS } from "../../shared/domain/discovery";
import { Link, navigate } from "../app/router";
import { useSession, useSignOut } from "../app/session";
import { usePageTitle } from "../app/usePageTitle";
import { AmendmentNotice } from "../components/AmendmentNotice";
import { ApiceList } from "../components/ApiceList";
import { ApiceLotSection } from "../components/ApiceLotSection";
import { ApiceMap } from "../components/ApiceMap";
import { MapBoundary } from "../components/MapView";
import { NoticeBell } from "../components/NoticeBell";
import type { ApiOps, OpClient } from "../data/api";
import type { NoticesSource } from "../data/notices";
import {
  firestoreListSource,
  type ApiceSource,
  type ListedApice,
  type ListSource,
} from "../data/apices";
import {
  firestoreNoticeSource,
  NO_NOTICE,
  type AmendmentNotice as AmendmentNoticeData,
  type NoticeSource,
} from "../data/constitution/notice";
import "./Dashboard.css";

/** «+» decorativo de «Nuevo ápice» (RF-9 (005) · 9.2). */
function PlusGlyph() {
  return (
    <svg
      className="dashboard-plus"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

export function Dashboard({
  source = firestoreListSource,
  noticeSource = firestoreNoticeSource,
  noticesSource,
  apiceSource,
  client,
}: {
  source?: ListSource;
  noticeSource?: NoticeSource;
  /** Avisos de la campana (RF-4 (012)); sin él, los de Firebase. */
  noticesSource?: NoticesSource;
  /** Para el panel del lote; sin ellos, los de Firebase. */
  apiceSource?: ApiceSource;
  client?: OpClient<ApiOps>;
}) {
  usePageTitle({ contentTitle: "Mi tablero" });
  const session = useSession();
  const signOut = useSignOut();
  const [items, setItems] = useState<readonly ListedApice[]>([]);
  const [notice, setNotice] = useState<AmendmentNoticeData>(NO_NOTICE);
  const [patches, setPatches] = useState<Record<string, Partial<ListedApice>>>(
    {},
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    if (session.status === "person") {
      // Si el aviso no se puede leer, Mi tablero sigue sin él (RF-15 (004) · 15.1).
      noticeSource.fetchNotice("member").then(
        (data) => {
          if (active) setNotice(data);
        },
        () => undefined,
      );
    }
    return () => {
      active = false;
    };
  }, [session.status, noticeSource]);

  useEffect(() => {
    if (session.status === "visitor")
      navigate("/entrar?volver=%2Ftablero", { replace: true });
  }, [session.status]);

  if (session.status === "loading") return <p>Cargando…</p>;
  // Visitante: la redirección ya está en curso. Suspendida: `App` pinta el aviso de suspensión (RF-11 (003) · 11.9).
  if (session.status !== "person") return null;

  const facilitator = session.role === "facilitator";
  // Primero a `/`, para que la guarda de visitante no lo devuelva a `/entrar` al cerrar (D-T13 (003)).
  const leave = () => {
    navigate("/");
    void signOut();
  };

  return (
    <div className="dashboard">
      <section className="dashboard__head" aria-label="Saludo">
        <div className="dashboard__greeting">
          <h1>Hola, @{session.username}</h1>
          <p className="dashboard-role">
            {facilitator ? "Facilitador" : "Persona inscrita"}
          </p>
        </div>
        <div className="dashboard__tools">
          <NoticeBell
            {...(noticesSource === undefined ? {} : { source: noticesSource })}
            {...(client === undefined ? {} : { client })}
          />
          <Link
            href="/apices/nuevo"
            className={`block dashboard-new ${editing ? "action-secondary" : "action-primary"}`}
          >
            <PlusGlyph />
            Nuevo ápice
          </Link>
        </div>
      </section>
      <AmendmentNotice
        openCount={notice.count}
        nextClosesAt={notice.nextCloseAt}
      />
      <section className="dashboard__apices" aria-labelledby="dashboard-apices">
        <h2 id="dashboard-apices">Mis ápices</h2>
        <ApiceLotSection
          items={items}
          {...(apiceSource === undefined ? {} : { source: apiceSource })}
          {...(client === undefined ? {} : { client })}
          onSaved={(id, fields) =>
            setPatches((current) => ({
              ...current,
              [id]: { ...current[id], ...fields },
            }))
          }
          onEditingChange={setEditing}
        />
        <MapBoundary>
          <ApiceMap
            apices={items.map((a) => ({
              id: a.id,
              name: a.name,
              axes: a.axes,
              location: a.location ?? null,
            }))}
            onSelect={(id) => navigate(`/apices/${id}`)}
          />
        </MapBoundary>
        <ApiceList
          onItems={setItems}
          patches={patches}
          audience="mine"
          filters={NO_FILTERS}
          uid={session.uid}
          source={source}
          empty={() => (
            <div className="block block-empty">
              <p>Todavía no tienes ápices. Crea el primero y aparecerá aquí.</p>
              <Link href="/apices/nuevo" className="block action-secondary">
                Crear el primero
              </Link>
            </div>
          )}
        />
      </section>
      <div className="dashboard-actions">
        <Link href="/archivados">Archivados</Link>
        {facilitator && (
          <Link href="/facilitacion/invitaciones">Facilitación</Link>
        )}
        <button
          type="button"
          className="block action-secondary"
          onClick={leave}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
