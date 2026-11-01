// RF-1 (009), RF-2 (009), RF-3 (009), RF-8 (009), RNF-4 (009) · Foro (`/foro`): hilos por actividad con filtro de eje, tandas de
// 20 y «Abrir un hilo» para quien puede. Estructura y textos del artboard del Foro (D-1 (008)).
import { useEffect, useState } from 'react';
import { AXES, type Axis } from '../../shared/domain/apice';
import { axisFilterLabel, repliesLabel, type ThreadSummary } from '../../shared/domain/forum';
import { axisIdentity } from '../../shared/domain/identity';
import { Link, navigate } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { AxisIcon } from '../components/AxisIcon';
import { ThreadForm, type ThreadFormValues } from '../components/ThreadForm';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreForumSource, type ForumSource, type ThreadPage } from '../data/forum';
import './Forum.css';

interface Props {
  source?: ForumSource;
  client?: OpClient<ApiOps>;
}

export function Forum({ source = firestoreForumSource, client = api }: Props) {
  usePageTitle({ contentTitle: 'Foro' });
  const session = useSession();
  const person = session.status === 'person';
  const [axis, setAxis] = useState<Axis | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [next, setNext] = useState<ThreadPage['next']>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setFailed(false);
    source.fetchThreads({ axis }).then(
      (page) => {
        if (cancelled) return;
        setThreads(page.threads);
        setNext(page.next);
        setReady(true);
      },
      () => {
        if (cancelled) return;
        setFailed(true);
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, axis]);

  const more = async () => {
    try {
      const page = await source.fetchThreads({ axis, after: next });
      setThreads((current) => [...current, ...page.threads]);
      setNext(page.next);
    } catch {
      setFailed(true);
    }
  };

  const open = async (values: ThreadFormValues) => {
    const { id } = await client.call('openThread', values);
    navigate(`/foro/${id}`);
  };

  return (
    <div className="forum">
      <header className="forum__head">
        <h1>Foro</h1>
        {person && !showForm && (
          <button type="button" className="block action-primary" onClick={() => setShowForm(true)}>
            Abrir un hilo
          </button>
        )}
      </header>
      {person && showForm && <ThreadForm onSubmit={open} onCancel={() => setShowForm(false)} />}
      <div role="toolbar" aria-label="Filtrar por eje" className="forum__filters">
        <button type="button" className="block icon-button forum__filter" aria-label="Todos los temas" title="Todos los temas" aria-pressed={axis === null} onClick={() => setAxis(null)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </button>
        {AXES.map((value) => (
          <button key={value} type="button" className="block icon-button forum__filter" aria-label={axisFilterLabel(value)} title={axisFilterLabel(value)} aria-pressed={axis === value} onClick={() => setAxis(axis === value ? null : value)}>
            <AxisIcon axis={value} size={22} />
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="block">
          No se pudieron cargar los hilos. Inténtalo de nuevo más tarde.
        </p>
      )}
      {ready && !failed && threads.length === 0 && (
        <div className="block block-empty">
          <p>Todavía no hay hilos{axis === null ? '' : ' en este eje'}.</p>
          {person && !showForm && (
            <button type="button" className="block action-secondary" onClick={() => setShowForm(true)}>
              Abrir un hilo
            </button>
          )}
        </div>
      )}
      {threads.length > 0 && (
        <section aria-label="Lista de hilos" className="forum__list">
          {threads.map((thread) => (
            <article key={thread.id} className="forum__row">
              <div aria-hidden="true" className="forum__axis" data-axis={axisIdentity(thread.axis).key}>
                <AxisIcon axis={thread.axis} size={22} />
              </div>
              <div className="forum__summary">
                <h2>
                  <Link href={`/foro/${thread.id}`}>{thread.title}</Link>
                </h2>
                <span>@{thread.authorUsername}</span>
              </div>
              <span className="forum__replies">{repliesLabel(Math.max(0, thread.messageCount - 1))}</span>
            </article>
          ))}
        </section>
      )}
      {next !== null && (
        <button type="button" className="block action-secondary forum__more" onClick={() => void more()}>
          Ver más hilos
        </button>
      )}
    </div>
  );
}
