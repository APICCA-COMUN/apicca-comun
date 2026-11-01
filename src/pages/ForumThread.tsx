// RF-4 (009), RF-5 (009), RF-6 (009), RF-7 (009), RNF-4 (009) · Hilo abierto (`/foro/:id`): título y eje, mensajes en orden
// cronológico con inicial, autoría, fecha y texto, y «Tu respuesta» con «Responder» para quien puede. La autora edita y archiva lo
// suyo; un facilitador archiva cualquier hilo o mensaje y ve lo archivado. Un hilo que no existe o está archivado es «no encontrado».
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
  const [data, setData] = useState<{ thread: Thread; messages: ForumMessage[] } | null | undefined>(undefined);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  usePageTitle({ contentTitle: data?.thread.title ?? 'Foro' });

  const load = useCallback(async () => {
    try {
      setData(await source.fetchThread(id, { includeArchived: moderates }));
    } catch {
      setData(null);
    }
  }, [source, id, moderates]);

  useEffect(() => {
    if (session.status === 'loading') return;
    void load();
  }, [load, session.status]);

  if (data === undefined) return <p>Cargando…</p>;
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

  const { thread, messages } = data;
  const axisKey = axisIdentity(thread.axis).key;
  const canReply = person !== null && !thread.isArchived;

  const run = async (action: () => Promise<unknown>, done?: () => void) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      done?.();
      await load();
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
    void run(() => client.call('editMessage', { threadId: id, messageId: editing.id, text: editing.text }), () => setEditing(null));
  };

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
        {messages.map((message) => (
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
        ))}
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
