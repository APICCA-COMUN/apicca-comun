// RF-4 (009), RF-5 (009), RF-6 (009), RF-7 (009), RNF-4 (009) · Hilo abierto (`/foro/:id`): título y eje, mensajes en orden
// cronológico con inicial, autoría, fecha y texto, y «Tu respuesta» con «Responder» para quien puede. La autora edita y archiva lo
// suyo; un facilitador archiva cualquier hilo o mensaje y ve lo archivado. Un hilo que no existe o está archivado es «no encontrado»; un fallo de lectura se avisa como error (RF-1 (017)).
// RF-1 (018), D-T5 (018) · Muestra la apertura y los mensajes más recientes; «Ver mensajes anteriores» suma páginas; al responder se relee la
// página reciente y se fusiona por `id`; al editar se reemplaza el texto en el estado, sin releer.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { validateMessage } from '../../shared/domain/forum';
import { axisIdentity } from '../../shared/domain/identity';
import { Link, useRoute } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { AXIS_LABEL, AxisIcon } from '../components/AxisIcon';
import { DocBlocks } from '../components/DocBlocks';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { firestoreForumSource, type ForumMessage, type ForumSource, type ForumThread as Thread } from '../data/forum';
import './Forum.css';

interface Props {
  source?: ForumSource;
  client?: OpClient<ApiOps>;
}

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });

function Formatted({ text }: { text: string }) {
  try {
    return <DocBlocks blocks={parseMarkdown(text)} />;
  } catch {
    return <p>{text}</p>;
  }
}

const messageOf = (caught: unknown): string =>
  caught instanceof ApiClientError ? caught.message : 'No se pudo completar. Inténtalo de nuevo; lo escrito se conservó.';

export function ForumThread({ source = firestoreForumSource, client = api }: Props) {
  const { params } = useRoute();
  const id = params['id'] ?? '';
  const session = useSession();
  const person = session.status === 'person' ? session : null;
  const moderates = person?.role === 'facilitator';
  // `undefined` mientras carga, `null` si no existe y `'failed'` si la lectura falló por otro motivo (RF-1 (017) · 1.3).
  const [data, setData] = useState<{ thread: Thread; opening: ForumMessage | null; messages: ForumMessage[]; before: QueryDocumentSnapshot | null } | null | 'failed' | undefined>(undefined);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  usePageTitle({ contentTitle: (typeof data === 'object' && data !== null ? data.thread.title : null) ?? 'Foro' });

  // `reload` es una relectura tras responder: conserva las páginas anteriores ya cargadas y su cursor (RF-1 (018) · 1.2, 1.4).
  const load = useCallback(
    async (reload = false) => {
      try {
        const found = await source.fetchThread(id, { includeArchived: moderates });
        setData((current) => {
          if (!reload || found === null || typeof current !== 'object' || current === null) return found;
          const fresh = new Set(found.messages.map((m) => m.id));
          const kept = current.messages.filter((m) => !fresh.has(m.id) && m.createdAt < (found.messages[0]?.createdAt ?? Infinity));
          return { ...found, messages: [...kept, ...found.messages], before: kept.length > 0 ? current.before : found.before };
        });
      } catch {
        setData('failed');
      }
    },
    [source, id, moderates],
  );

  useEffect(() => {
    if (session.status === 'loading') return;
    void load();
  }, [load, session.status]);

  if (data === undefined) return <p>Cargando…</p>;
  if (data === 'failed') {
    return (
      <div className="forum-thread">
        <h1>Foro</h1>
        <p role="alert" className="block">
          No se pudo cargar este hilo. Inténtalo de nuevo en un momento.
        </p>
        <p>
          <Link href="/foro">Volver al foro</Link>
        </p>
      </div>
    );
  }
  if (data === null || (data.thread.isArchived && !moderates)) {
    return (
      <div className="forum-thread">
        <h1>No encontramos ese hilo</h1>
        <p>
          Puede que se haya archivado o que el enlace no sea correcto. <Link href="/foro">Volver al foro</Link>
        </p>
      </div>
    );
  }

  const { thread, opening, messages } = data;
  const axisKey = axisIdentity(thread.axis).key;
  const canReply = person !== null && !thread.isArchived;

  const run = async (action: () => Promise<unknown>, done?: () => void, reload = true) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      done?.();
      if (reload) await load(true);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const check = validateMessage(reply);
    if (!check.ok) {
      setError(check.reason ?? null);
      return;
    }
    void run(() => client.call('replyThread', { threadId: id, text: reply }), () => setReply(''));
  };

  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (editing === null) return;
    const check = validateMessage(editing.text);
    if (!check.ok) {
      setError(check.reason ?? null);
      return;
    }
    const edited = editing;
    // Al editar no se relee: el mensaje puede no estar entre los más recientes (RF-1 (018) · 1.5, D-T5 (018)).
    const apply = () => {
      const editedAt = Date.now();
      const patch = (m: ForumMessage): ForumMessage => (m.id === edited.id ? { ...m, text: edited.text, editedAt } : m);
      setData((current) => (typeof current === 'object' && current !== null ? { ...current, opening: current.opening === null ? null : patch(current.opening), messages: current.messages.map(patch) } : current));
      setEditing(null);
    };
    void run(() => client.call('editMessage', { threadId: id, messageId: edited.id, text: edited.text }), apply, false);
  };

  const loadOlder = async () => {
    if (data.before === null) return;
    setError(null);
    setBusy(true);
    try {
      const page = await source.fetchOlder(id, { includeArchived: moderates, before: data.before });
      setData((current) => {
        if (typeof current !== 'object' || current === null) return current;
        const loaded = new Set(current.messages.map((m) => m.id));
        return { ...current, messages: [...page.messages.filter((m) => !loaded.has(m.id)), ...current.messages], before: page.before };
      });
    } catch {
      setError('No se pudieron cargar los mensajes anteriores. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const renderMessage = (message: ForumMessage) => (
    <article key={message.id} className="forum-message">
      <div aria-hidden="true" className="forum-message__initial" data-axis={axisKey}>
        {message.authorUsername.charAt(0).toUpperCase()}
      </div>
      <div className="forum-message__body">
        <div className="forum-message__meta">
          <strong>@{message.authorUsername}</strong>
          <span>{formatDate(message.createdAt)}</span>
          {message.editedAt !== null && <span>editado</span>}
          {message.isArchived && <span>Archivado</span>}
        </div>
        {editing?.id === message.id ? (
          <form className="forum-reply" aria-label="Editar mensaje" noValidate onSubmit={saveEdit}>
            <label>
              Tu mensaje
              <textarea className="block" rows={3} value={editing.text} onChange={(event) => setEditing({ id: message.id, text: event.target.value })} />
            </label>
            <div className="thread-form__actions">
              <button type="submit" className="block action-primary" disabled={busy}>
                Guardar
              </button>
              <button type="button" className="block action-secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="forum-message__text">
            <Formatted text={message.text} />
          </div>
        )}
        {person !== null && !thread.isArchived && !message.isArchived && editing?.id !== message.id && (
          <div className="forum-message__actions">
            {message.authorUid === person.uid && (
              <button type="button" className="block action-secondary" onClick={() => setEditing({ id: message.id, text: message.text })}>
                Editar
              </button>
            )}
            {!message.isOpening && (message.authorUid === person.uid || moderates) && (
              <button type="button" className="block action-secondary" disabled={busy} onClick={() => void run(() => client.call('archiveMessage', { threadId: id, messageId: message.id }))}>
                Archivar mensaje
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );

  return (
    <div className="forum-thread">
      <section aria-labelledby="hilo-titulo" className="forum-thread__head">
        <span className="forum-thread__eyebrow">
          <AxisIcon axis={thread.axis} size={20} />
          {AXIS_LABEL[thread.axis]}
          {thread.isArchived && ' · Archivado'}
        </span>
        <div className="forum-thread__head-row">
          <h1 id="hilo-titulo">{thread.title}</h1>
          {person !== null && !thread.isArchived && (moderates || person.uid === thread.authorUid) && (
            <button type="button" className="block action-secondary" disabled={busy} onClick={() => void run(() => client.call('archiveThread', { threadId: id }))}>
              Archivar hilo
            </button>
          )}
        </div>
        <Link href="/foro">Volver al foro</Link>
      </section>
      <div className="forum-thread__messages">
        {opening !== null && renderMessage(opening)}
        {data.before !== null && (
          <button type="button" className="block action-secondary forum__more" disabled={busy} onClick={() => void loadOlder()}>
            Ver mensajes anteriores
          </button>
        )}
        {messages.map(renderMessage)}
      </div>
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}
      {canReply && (
        <form className="forum-reply" aria-label="Responder" noValidate onSubmit={send}>
          <label>
            Tu respuesta
            <textarea className="block" rows={3} placeholder="Escribe tu respuesta…" value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <button type="submit" className="block action-secondary" disabled={busy} aria-busy={busy}>
            Responder
          </button>
        </form>
      )}
      {!canReply && !thread.isArchived && session.status !== 'loading' && (
        <p>
          {session.status === 'suspended' ? 'Tu cuenta está suspendida: puedes leer, pero no responder.' : (
            <>
              <Link href="/entrar">Inicia sesión</Link> para responder.
            </>
          )}
        </p>
      )}
    </div>
  );
}
