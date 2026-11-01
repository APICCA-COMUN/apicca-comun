// RF-12 (001), RF-6 (002) · 6.1, 6.3; RF-4 (003) · 4.6; RF-12 (003) · 12.1, 12.5; RF-3 (003) · 3.3 · Historial de un ápice: versiones de la más reciente a la más antigua con quién y cuándo, y
// restaurar una versión anterior como versión nueva (con manejo de conflicto y de ápice archivado; «Restaurar» es secundaria).
import { useEffect, useMemo, useState } from 'react';
import { canEdit, canSeeHistory, type ApiceViewer } from '../../shared/domain/access';
import { Link } from '../app/router';
import { useSession, type PersonSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';
import { firestoreHistorySource, type ApiceHead, type HistorySource, type VersionRow } from '../data/versions';

interface Props {
  id: string;
  source?: HistorySource;
  client?: OpClient<ApiOps>;
}

const KIND_LABELS = { create: 'Creación', edit: 'Edición' } as const;

/** Fecha y hora de un guardado, en hora de Colombia. */
function formatWhen(at: VersionRow['savedAt']): string {
  return new Date(at.seconds * 1000).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
}

export function ApiceHistory({ id, source = firestoreHistorySource, client = api }: Props) {
  usePageTitle({ area: 'Ápices', contentTitle: 'Historial' });
  const session = useSession();
  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status !== 'person') {
    return (
      <section>
        <h2>Historial</h2>
        <p>El historial es solo para cuentas con sesión activa.</p>
        <Link href="/entrar">Entrar</Link>
      </section>
    );
  }
  return <History id={id} source={source} client={client} session={session} />;
}

type Conflict = { n: number; currentVersion: number };

function History({ id, source, client, session }: Required<Props> & { session: PersonSession }) {
  const [head, setHead] = useState<ApiceHead | null | undefined>(undefined);
  useEffect(() => source.onApice(id, setHead), [source, id]);

  const viewer: ApiceViewer = { uid: session.uid, role: session.role, status: 'active' };
  const allowed = head != null && canSeeHistory(viewer, head);

  if (head === undefined) return <p>Cargando…</p>;
  if (!allowed) {
    return (
      <section>
        <h2>Historial</h2>
        <p>No se encontró el ápice.</p>
      </section>
    );
  }
  return <Versions id={id} head={head} source={source} client={client} canRestore={canEdit(viewer, head)} />;
}

function Versions({ id, head, source, client, canRestore }: { id: string; head: ApiceHead; source: HistorySource; client: OpClient<ApiOps>; canRestore: boolean }) {
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  useEffect(() => source.onVersions(id, setRows, () => setFailed(true)), [source, id]);
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => b.n - a.n), [rows]);

  const restore = async (n: number, baseVersion: number) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    setConflict(null);
    try {
      const result = await client.call('restoreVersion', { id, n, baseVersion });
      if (result.ok) setNotice(`La versión ${n} quedó como versión ${result.version}.`);
      else setConflict({ n, currentVersion: result.current.version });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo restaurar la versión. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lot">
      <h2>Historial</h2>
      {head.isArchived ? <p>Este ápice está archivado: no se pueden restaurar versiones.</p> : null}
      {notice === null ? null : <p role="status" className="block">{notice}</p>}
      {error === null ? null : <p role="alert" className="block">{error}</p>}
      {conflict === null ? null : (
        <p role="alert" className="block">
          Alguien guardó otra versión mientras tanto; no se restauró nada.{' '}
          <button type="button" className="block action-secondary" disabled={busy} onClick={() => void restore(conflict.n, conflict.currentVersion)}>
            Restaurar sobre la versión vigente
          </button>
        </p>
      )}
      {failed ? <p role="alert" className="block">No se pudo leer el historial.</p> : null}
      <ul aria-label="Versiones">
        {sorted.map((row) => (
          <li key={row.n} className="block">
            <strong>Versión {row.n}</strong> · {row.kind === 'restore' ? `Restaurada de la versión ${row.restoredFromN ?? '?'}` : KIND_LABELS[row.kind]} ·{' '}
            por {row.savedByUsername} · {formatWhen(row.savedAt)}
            {canRestore && row.n !== head.version ? (
              <>
                {' '}
                <button type="button" className="block action-secondary" disabled={busy} onClick={() => void restore(row.n, head.version)}>
                  Restaurar
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
