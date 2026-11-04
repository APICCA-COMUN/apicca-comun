// RF-4 (012) · campana de avisos en la fila del saludo.
// RF-8 (008) · 8.1–8.8, D-10 (008) (en `Dashboard.css`), RF-11 (003) · 11.1–11.7, 11.9, 11.10, RF-4 (003) · 4.9, D-T13 (003); RF-15 (004) · 15.1 · Mi tablero (`/tablero`): saludo, rol, «Nuevo ápice»,
// mapa y lista de los ápices propios, «Archivados», «Cerrar sesión», aviso de propuestas abiertas (RF-15 (004) · 15.1) y, para quien facilita, el enlace a Facilitación.
// RF-9 (005) · 9.1, 9.2, RF-7 (005) · 7.8, 7.11, D-8 (005): «Mis ápices» con el lote ilustrado y su panel encima del mapa y la
// lista; «Nuevo ápice» lleva un «+» decorativo y pasa a secundario mientras se ve la edición rápida.
// RF-6 (019) · 6.1 a 6.3, RF-7 (019) · 7.1 a 7.3, D-T17 (019), D-T20 (019): el terreno es la vista principal y la lista su
// alternativa (`?vista=lista`), nunca las dos a la vez; el contador y el control de vista van en la franja.
// RF-19 (019), D-T22 (019): sin ápices, solo el terreno de partida, y «Nuevo ápice» pasa a secundario.
// RF-10 (019) · 10.5, D-T25 (019): el mapa de los ápices propios va debajo del terreno y solo se monta cuando se pide.
import { useEffect, useLayoutEffect, useState } from "react";
import { NO_FILTERS } from "../../shared/domain/discovery";
import { Link, navigate } from "../app/router";
import { useSession, useSignOut } from "../app/session";
import { usePageTitle } from "../app/usePageTitle";
import { AmendmentNotice } from "../components/AmendmentNotice";
import { useApiceListing } from "../app/useApiceListing";
import { ApiceList } from "../components/ApiceList";
import { ApiceLotSection } from "../components/ApiceLotSection";
import { ApiceMap } from "../components/ApiceMap";
import { MapBoundary } from "../components/MapView";
import { NoticeBell } from "../components/NoticeBell";
import { StartingTerrain } from "../components/StartingTerrain";
import {
  MAP_REGION_ID,
  TerrainStrip,
  viewFromSearch,
  withView,
  type ListingView,
} from "../components/TerrainStrip";
import type { ApiOps, OpClient } from "../data/api";
import type { NoticesSource } from "../data/notices";
import {
  firestoreListSource,
  type ApiceSource,
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
  const [notice, setNotice] = useState<AmendmentNoticeData>(NO_NOTICE);
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);

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
            className={`block dashboard-new ${editing || starting ? "action-secondary" : "action-primary"}`}
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
        <MyApices
          uid={session.uid}
          source={source}
          {...(apiceSource === undefined ? {} : { apiceSource })}
          {...(client === undefined ? {} : { client })}
          onEditingChange={setEditing}
          onStartingChange={setStarting}
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

/** Los ápices propios: terreno o lista, con la franja, el mapa y el terreno de partida (RF-6 (019), RF-7 (019), RF-10 (019) y RF-19 (019)). */
function MyApices({
  uid,
  source,
  apiceSource,
  client,
  onEditingChange,
  onStartingChange,
}: {
  uid: string;
  source: ListSource;
  apiceSource?: ApiceSource;
  client?: OpClient<ApiOps>;
  onEditingChange(editing: boolean): void;
  onStartingChange(starting: boolean): void;
}) {
  const listing = useApiceListing({ audience: "mine", filters: NO_FILTERS, uid, source });
  const [view, setView] = useState<ListingView>(() => viewFromSearch(window.location.search));
  const [mapOpen, setMapOpen] = useState(false);
  const starting = listing.empty === "no-apices";
  // Antes de pintar, para que «Nuevo ápice» nunca se vea azul junto al terreno de partida (RF-19 (019) · 19.4).
  useLayoutEffect(() => onStartingChange(starting), [starting]);

  if (starting) {
    return (
      <StartingTerrain
        phrase="Todavía no tienes ápices en el terreno."
        action={{ label: "Propón tu primer ápice", href: "/apices/nuevo" }}
      />
    );
  }
  const switchView = (next: ListingView) => {
    setView(next);
    navigate(`/tablero${withView("", next)}`, { replace: true });
  };
  const terrain = view === "terreno" && listing.status !== "error" && listing.empty === null;
  return (
    <>
      <TerrainStrip
        listing={listing}
        view={view}
        onView={switchView}
        map={{ open: mapOpen, onToggle: () => setMapOpen(!mapOpen) }}
      />
      {terrain ? (
        <ApiceLotSection
          items={listing.items}
          {...(apiceSource === undefined ? {} : { source: apiceSource })}
          {...(client === undefined ? {} : { client })}
          onSaved={listing.patch}
          onEditingChange={onEditingChange}
        />
      ) : (
        <ApiceList listing={listing} empty={() => null} />
      )}
      <div id={MAP_REGION_ID} className="terrain-map">
        {mapOpen && (
          <MapBoundary>
            <ApiceMap
              apices={listing.items.map((a) => ({
                id: a.id,
                name: a.name,
                axes: a.axes,
                location: a.location ?? null,
              }))}
              onSelect={(id) => navigate(`/apices/${id}`)}
            />
          </MapBoundary>
        )}
      </div>
    </>
  );
}
