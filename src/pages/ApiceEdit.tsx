// RF-10 (001), RF-11 (001), RF-9 (001), RF-1 (016), RNF-10 (001), RF-6 (002) · 6.1, RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2 · Edición de un ápice: cualquier cuenta activa edita uno no archivado.
// El formulario guarda con la versión que abrió; si alguien guardó antes, se muestra el conflicto y se elige
// entre conservar lo propio (se reenvía sobre la versión vigente) o descartarlo.
import { useEffect, useState } from 'react';
import type { Point } from '../../shared/domain/location';
import { canEdit, canSetLocation, type ApiceViewer } from '../../shared/domain/access';
import { messageFor } from '../../shared/domain/messages';
import type { EditableFields } from '../../shared/domain/versions';
import { ConflictDiff } from '../components/ConflictDiff';
import { ContentForm, saveFailureText } from '../components/ContentForm';
import { useDrafts } from '../app/drafts';
import { Link, navigate } from '../app/router';
import { useSession, type PersonSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, type ApiOps, type LocationEdit, type OpClient } from '../data/api';
import { firestoreApiceSource, type ApiceDoc, type ApiceSource } from '../data/apices';

interface Props {
  id: string;
  source?: ApiceSource;
  client?: OpClient<ApiOps>;
}

const fieldsOf = (apice: EditableFields): EditableFields => ({
  name: apice.name,
  description: apice.description,
  axes: apice.axes,
  needs: apice.needs,
  offers: apice.offers,
  status: apice.status,
});

export function ApiceEdit({ id, source = firestoreApiceSource, client = api }: Props) {
  usePageTitle({ area: 'Ápices', contentTitle: 'Editar ápice' });
  const session = useSession();
  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status !== 'person') {
    return (
      <section>
        <h1>Editar ápice</h1>
        <p>Para editar un ápice necesitas entrar con una cuenta activa.</p>
        <Link href="/entrar">Entrar</Link>
      </section>
    );
  }
  return <Loader id={id} source={source} client={client} session={session} />;
}

function Loader({ id, source, client, session }: Required<Props> & { session: PersonSession }) {
  /** Lo último que dice el almacén: decide el acceso. */
  const [latest, setLatest] = useState<ApiceDoc | null | undefined>(undefined);
  /** Lo que había al abrir: el formulario y su versión base no se mueven aunque lleguen cambios. */
  const [opened, setOpened] = useState<ApiceDoc | null>(null);
  useEffect(
    () =>
      source.onApice(id, (apice) => {
        setLatest(apice);
        setOpened((previous) => previous ?? apice);
      }),
    [source, id],
  );

  if (latest === undefined) return <p>Cargando…</p>;
  if (latest === null || opened === null) return <Message>No se encontró el ápice.</Message>;
  const viewer: ApiceViewer = { uid: session.uid, role: session.role, status: 'active' };
  if (latest.isArchived) return <Message>{messageFor('apice-archived')}</Message>;
  if (!canEdit(viewer, latest)) return <Message>No tienes permiso para editar este ápice.</Message>;
  // Solo la autora y la facilitación leen el punto exacto (RF-9 (001)) y fijan o vuelven exacta la ubicación (RF-1 (016)).
  const mayReadExact = canSetLocation(viewer, latest);
  return <Editor id={id} client={client} opened={opened} latest={latest} source={source} mayReadExact={mayReadExact} />;
}

function Message({ children }: { children: string }) {
  return (
    <section>
      <h1>Editar ápice</h1>
      <p>{children}</p>
    </section>
  );
}

interface Conflict {
  mine: EditableFields;
  location: LocationEdit;
  current: { version: number; content: EditableFields };
}

interface EditorProps {
  id: string;
  client: OpClient<ApiOps>;
  opened: ApiceDoc;
  /** Lo último del almacén: al descartar lo propio en un conflicto, la ubicación vuelve a la vigente. */
  latest: ApiceDoc;
  source: ApiceSource;
  mayReadExact: boolean;
}

const KEEP: LocationEdit = { mode: 'keep' };

function Editor({ id, client, opened, latest, source, mayReadExact }: EditorProps) {
  const drafts = useDrafts();
  const draftKey = `apice:${id}`;
  const [base, setBase] = useState({ version: opened.version, values: fieldsOf(opened), location: opened.location ?? null, n: 0 });
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [exact, setExact] = useState<Point | undefined>(undefined);

  // El punto exacto de la versión base; el resto de las personas ni lo piden.
  useEffect(() => {
    setExact(undefined);
    if (!mayReadExact || source.readExact === undefined || base.location === null) return;
    let current = true;
    void source.readExact(id, base.version).then((point) => {
      if (current && point !== null) setExact(point);
    });
    return () => {
      current = false;
    };
  }, [source, id, base.version, base.location, mayReadExact]);

  /** Guarda sobre `baseVersion`; deja el error al que llama y el conflicto en el estado. */
  const send = async (content: EditableFields, baseVersion: number, location: LocationEdit): Promise<void> => {
    // Conservar es no mandar el campo: el servidor no toca ni lee el punto exacto.
    const place = location.mode === 'keep' ? {} : { location };
    const result = await client.call('editApice', { id, baseVersion, content, ...place });
    if (result.ok) {
      drafts.clear(draftKey);
      navigate(`/apices/${id}`);
    } else {
      setConflict({ mine: content, location, current: result.current });
    }
  };

  if (conflict !== null) {
    const keepMine = async (): Promise<void> => {
      setBusy(true);
      setFailure(null);
      try {
        await send(conflict.mine, conflict.current.version, conflict.location);
      } catch (error) {
        setFailure(saveFailureText(error));
      } finally {
        setBusy(false);
      }
    };
    const discard = (): void => {
      drafts.clear(draftKey);
      // La ubicación también vuelve a la vigente: la que se abrió pudo cambiar o quitarse (RF-1 (016)).
      const location = latest.version === conflict.current.version ? (latest.location ?? null) : base.location;
      setBase((previous) => ({ version: conflict.current.version, values: conflict.current.content, location, n: previous.n + 1 }));
      setConflict(null);
      setFailure(null);
    };
    return (
      <section className="lot">
        <h1>Editar ápice</h1>
        <ConflictDiff mine={conflict.mine} current={conflict.current.content} onKeepMine={() => void keepMine()} onDiscard={discard} busy={busy} />
        {failure !== null && <p role="alert" className="block">{failure}</p>}
      </section>
    );
  }

  return (
    <section className="lot">
      <h1>Editar ápice</h1>
      <ContentForm
        key={base.n}
        initial={base.values}
        draftKey={draftKey}
        submitLabel="Guardar cambios"
        showStatus
        location={{ stored: base.location, exact, mayRaise: mayReadExact }}
        onSubmit={(values, location) => send(values, base.version, location ?? KEEP)}
      />
    </section>
  );
}
