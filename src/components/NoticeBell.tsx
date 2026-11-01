// RF-4 (012), RF-5 (012), RF-3 (012), RF-7 (012), RNF-3 (012) · Campana de avisos de Mi tablero: botón de ícono con el contador, y un panel con los
// avisos y «Marcar como leídos». Solo la ven las personas con cuenta activa (RF-4 (012)); los datos entran por `source`.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { bellLabel, countLabel, noticeText, unreadCount } from '../../shared/domain/notices';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreNoticesSource, type NoticesData, type NoticesSource } from '../data/notices';
import './NoticeBell.css';

const EMPTY: NoticesData = { notices: [], seenAt: null };

function BellGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" className="notice-bell__glyph">
      <path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4L6 17zM10 20h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NoticeBell({ source = firestoreNoticesSource, client = api }: { source?: NoticesSource; client?: OpClient<ApiOps> }) {
  const session = useSession();
  const uid = session.status === 'person' ? session.uid : null;
  const panelId = useId();
  const [data, setData] = useState<NoticesData>(EMPTY);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    if (uid === null) return;
    try {
      setData(await source.fetchNotices(uid));
    } catch {
      // Sin avisos legibles, Mi tablero sigue sin campana activa (RF-4 (012)).
    }
  }, [source, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  // RF-7 (012), D-T10 (012): con el panel abierto, Escape lo cierra y devuelve el foco; un clic afuera, también lo cierra.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      bellRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (uid === null) return null;

  const unread = unreadCount(data.notices, data.seenAt);
  const markSeen = async () => {
    setFailed(false);
    try {
      await client.call('markNoticesSeen', {});
      await load();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="notice-bell" ref={rootRef}>
      <button ref={bellRef} type="button" className="block icon-button" aria-label={bellLabel(unread)} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <BellGlyph />
      </button>
      {unread > 0 && (
        <span className="notice-bell__count" aria-hidden="true">
          {countLabel(unread)}
        </span>
      )}
      {open && (
        <section id={panelId} className="block notice-panel" aria-label="Avisos">
          {data.notices.length === 0 ? (
            <p>No tienes avisos</p>
          ) : (
            <ul className="notice-panel__list">
              {data.notices.map((n) => (
                <li key={n.id} className={n.at > (data.seenAt ?? -1) ? 'notice-panel__item notice-panel__item--unread' : 'notice-panel__item'}>
                  <Link href={n.href}>{noticeText(n)}</Link>
                </li>
              ))}
            </ul>
          )}
          {data.notices.length > 0 && (
            <button type="button" className="block action-secondary" disabled={unread === 0} onClick={() => void markSeen()}>
              Marcar como leídos
            </button>
          )}
          {failed && <p role="alert" className="block">No se pudo marcar. Inténtalo de nuevo.</p>}
        </section>
      )}
    </div>
  );
}
