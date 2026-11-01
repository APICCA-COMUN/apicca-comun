// RF-7 (004) · 7.4, RF-8 (004) · 8.1–8.4, RF-9 (004) · 9.1–9.4, RF-10 (004) · 10.1–10.4, RF-11 (004) · 11.1–11.3,
// RF-12 (004) · 12.5, RF-14 (004) · 14.4, 14.7, RF-17 (004) · 17.1–17.2 · Página `/constitucion/propuestas/:id`:
// contenido, revisiones, acuerdos contados, objeciones, posturas y deliberación de una propuesta. Refleja el vencimiento
// antes de pintar. Las acciones siguen la tabla de la spec 004 §4.3; sin cuenta activa, solo el aviso.
import { useEffect, useState } from 'react';
import { validateComment, type Amendment, type Objection, type Stance } from '../../shared/domain/constitution';
import { todayInColombia } from '../../shared/domain/dates';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';
import { firestoreAmendmentsSource, type AmendmentComment, type AmendmentRevision, type AmendmentsSource } from '../data/constitution/amendments';
import { settleThenRead, type SettleCall } from '../data/constitution/settle';
import { AmendmentForm, type AmendmentFormValues, type AmendmentSubmitResult } from '../components/AmendmentForm';
import { DeliberationList, type DeliberationComment } from '../components/DeliberationList';
import { DocBlocks } from '../components/DocBlocks';
import { JoinNotice } from '../components/JoinNotice';
import { StanceBar } from '../components/StanceBar';
import { SuspendedNotice } from '../components/SuspendedNotice';

interface Props {
  id: string;
  source?: AmendmentsSource;
  client?: OpClient<ApiOps>;
  settle?: SettleCall;
}

const KIND_LABEL = { change: 'Cambiar una sección', add: 'Añadir una sección', remove: 'Quitar una sección' } as const;
const RESULT_LABEL = { approved: 'Aprobada', rejected: 'No aprobada', withdrawn: 'Retirada' } as const;
const REASON_LABEL = { insufficient_agreements: 'Acuerdos insuficientes', open_objection: 'Objeción abierta' } as const;
const OBJECTION_LABEL = { open: 'abierta', resolved: 'resuelta', withdrawn: 'retirada' } as const;

function Formatted({ text }: { text: string }) {
  try {
    return <DocBlocks blocks={parseMarkdown(text)} />;
  } catch {
    return <p>{text}</p>;
  }
}

const messageOf = (error: unknown): string =>
  error instanceof ApiClientError ? error.message : 'No se pudo completar la acción. Inténtalo de nuevo; lo escrito se conservó.';

type Composer = { mode: 'new' } | { mode: 'edit'; comment: DeliberationComment };

export function AmendmentView({ id, source = firestoreAmendmentsSource, client = api, settle }: Props) {
  const session = useSession();
  const active = session.status === 'person';
  const [ready, setReady] = useState(false);
  const [amendment, setAmendment] = useState<Amendment | null>(null);
  const [revisions, setRevisions] = useState<AmendmentRevision[]>([]);
  const [comments, setComments] = useState<AmendmentComment[]>([]);
  const [stances, setStances] = useState<Stance[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentNote, setCommentNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  usePageTitle({ area: 'Constitución', contentTitle: amendment?.title ?? 'Propuesta' });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const stops: Array<() => void> = [];
    void (async () => {
      // Refleja el vencimiento de esta propuesta antes de mostrarla (RF-12 (004) · 12.5).
      await settleThenRead({ active: true, id, ...(settle === undefined ? {} : { settle }), read: () => undefined });
      if (cancelled) return;
      stops.push(
        source.onAmendment(id, (a) => {
          setAmendment(a);
          setReady(true);
        }),
        source.onRevisions(id, setRevisions),
        source.onComments(id, setComments),
        source.onStances(id, setStances),
        source.onObjections(id, setObjections),
      );
    })();
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [active, id, source, settle]);

  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status === 'suspended') return <SuspendedNotice />;
  if (session.status === 'visitor') {
    return (
      <section className="lot">
        <h1>Propuesta de cambio</h1>
        <JoinNotice />
      </section>
    );
  }
  if (!ready) return <p>Cargando…</p>;
  if (amendment === null) {
    return (
      <section className="lot">
        <h1>Propuesta de cambio</h1>
        <p>No se encontró la propuesta.</p>
        <Link href="/constitucion/propuestas">Ver las propuestas</Link>
      </section>
    );
  }

  const isOpen = amendment.isOpen;
  const isAuthor = session.uid === amendment.authorUid;
  const mine = stances.find((s) => s.uid === session.uid);
  const myOpenObjection = objections.find((o) => o.uid === session.uid && o.status === 'open');
  const others = stances.filter((s) => s.agreement === 'active' && s.uid !== amendment.authorUid);
  // RF-14 (004) · 14.4, 14.7: el servidor lo mantiene en la propuesta al suspender y reactivar la cuenta.
  const authorSuspended = amendment.authorSuspended;
  const counted = isOpen ? others.length + (authorSuspended ? 0 : 1) : amendment.agreementsCounted;
  const call = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(messageOf(caught));
    }
  };
  const amendmentId = amendment.id;

  const submitRevision = async (values: AmendmentFormValues): Promise<AmendmentSubmitResult> => {
    const result = await client.call('reviseAmendment', {
      amendmentId,
      baseRevision: amendment.revisionNo,
      ...(values as { title?: string; text?: string; motive: string }),
    });
    if (result.ok) {
      setReviseOpen(false);
      return { ok: true, revisionNo: result.revisionNo };
    }
    return result;
  };

  const closeComposer = () => {
    setComposer(null);
    setCommentText('');
    setCommentNote(null);
  };
  const submitComment = async () => {
    const check = validateComment(commentText);
    if (!check.ok) {
      setCommentNote(check.reason ?? 'El comentario no es válido.');
      return;
    }
    setCommentNote(null);
    try {
      if (composer?.mode === 'edit') {
        const result = await client.call('editComment', {
          amendmentId,
          commentId: composer.comment.id,
          text: commentText,
          baseVersion: composer.comment.version,
        });
        if (!result.ok) {
          setCommentNote(`Alguien editó este comentario mientras escribías. Lo vigente dice: «${result.current.text}»`);
          return;
        }
      } else {
        await client.call('commentAmendment', { amendmentId, text: commentText });
      }
      closeComposer();
    } catch (caught) {
      setCommentNote(messageOf(caught));
    }
  };

  const deliberation: DeliberationComment[] = comments;

  return (
    <article className="lot amendment-view">
      <header>
        <h1>{amendment.title}</h1>
        <p className="amendment-meta">
          {KIND_LABEL[amendment.kind]} · Por {amendment.authorUsername} · Abierta el {todayInColombia(new Date(amendment.openedAt))} · Revisión{' '}
          {amendment.revisionNo}
        </p>
      </header>
      {isOpen ? (
        <p className="block">
          Cierra el {todayInColombia(new Date(amendment.closesAt))}
          {amendment.extended ? ' (plazo ampliado)' : ''}.
        </p>
      ) : (
        <div className="block">
          <p>
            Resultado: {amendment.result === null ? 'Cerrada' : RESULT_LABEL[amendment.result]}
            {amendment.closedAt === null ? '' : ` · ${todayInColombia(new Date(amendment.closedAt))}`}
          </p>
          {amendment.reasons.length > 0 && <p>Motivos: {amendment.reasons.map((r) => REASON_LABEL[r]).join(', ')}</p>}
        </div>
      )}
      {amendment.kind !== 'remove' && <Formatted text={amendment.text} />}
      <p>Motivo: {amendment.motive}</p>

      <section className="lot" aria-label="Acuerdos">
        <h2>Acuerdos</h2>
        <p className="block">
          {counted} {counted === 1 ? 'acuerdo contado' : 'acuerdos contados'}
          {authorSuspended && isOpen ? ' (sin el de quien propone, que tiene la cuenta suspendida)' : ' (incluye el de quien propone)'}
        </p>
        {others.length > 0 && (
          <ul className="lot">
            {others.map((s) => (
              <li key={s.uid} className="block">
                {s.username}
                {s.agreedAtRevision !== null && s.agreedAtRevision < amendment.revisionNo
                  ? ` (anterior a la revisión ${amendment.revisionNo})`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      {objections.length > 0 && (
        <section className="lot" aria-label="Objeciones">
          <h2>Objeciones</h2>
          <ul className="lot">
            {objections.map((o) => (
              <li key={o.id} className="block">
                <p>
                  {o.username} · {OBJECTION_LABEL[o.status]}
                </p>
                <p>{o.reason}</p>
                {isOpen && o.status === 'open' && o.uid === session.uid && (
                  <>
                    <button
                      type="button"
                      className="block action-secondary"
                      onClick={() => void call(() => client.call('resolveObjection', { amendmentId, objectionId: o.id }))}
                    >
                      Dar por resuelta
                    </button>
                    {amendment.revisionNo > 1 && (
                      <button
                        type="button"
                        className="block action-secondary"
                        onClick={() =>
                          void call(() =>
                            client.call('resolveObjection', { amendmentId, objectionId: o.id, resolvedByRevision: amendment.revisionNo }),
                          )
                        }
                      >
                        Resuelta por la revisión {amendment.revisionNo}
                      </button>
                    )}
                    <button
                      type="button"
                      className="block action-secondary"
                      onClick={() => void call(() => client.call('withdrawObjection', { amendmentId, objectionId: o.id }))}
                    >
                      Retirar objeción
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {actionError !== null && (
        <p role="alert" className="block">
          {actionError}
        </p>
      )}

      {isOpen && (
        <StanceBar
          isAuthor={isAuthor}
          hasAgreed={mine?.agreement === 'active'}
          hasOpenObjection={myOpenObjection !== undefined || (mine?.openObjectionId ?? null) !== null}
          authorSuspended={authorSuspended}
          onAgree={() => client.call('agreeAmendment', { amendmentId })}
          onRevoke={() => client.call('revokeAgreement', { amendmentId })}
          onObject={(reason) => client.call('objectAmendment', { amendmentId, reason })}
          onRevise={() => setReviseOpen(true)}
          onWithdraw={() => client.call('withdrawAmendment', { amendmentId })}
        />
      )}

      {reviseOpen && isOpen && isAuthor && !authorSuspended && (
        <div role="dialog" aria-modal="true" aria-labelledby="revise-title" className="block">
          <h2 id="revise-title">Revisar la propuesta</h2>
          <AmendmentForm
            mode="revise"
            sections={[]}
            kind={amendment.kind}
            {...(amendment.sectionId === null ? {} : { sectionId: amendment.sectionId })}
            initial={{ title: amendment.title, text: amendment.text, motive: amendment.motive }}
            onSubmit={submitRevision}
            onCancel={() => setReviseOpen(false)}
          />
        </div>
      )}

      <section className="lot" aria-label="Deliberación de la propuesta">
        <h2>Deliberación</h2>
        <DeliberationList
          comments={deliberation}
          isOpen={isOpen}
          currentUid={session.uid}
          isFacilitator={session.role === 'facilitator'}
          onEdit={(comment) => {
            setComposer({ mode: 'edit', comment });
            setCommentText(comment.text);
            setCommentNote(null);
          }}
          onArchive={(commentId) => void call(() => client.call('archiveComment', { amendmentId, commentId }))}
        />
        {isOpen && composer === null && (
          <button type="button" className="block action-secondary" onClick={() => setComposer({ mode: 'new' })}>
            Comentar
          </button>
        )}
        {isOpen && composer !== null && (
          <div className="block">
            <label htmlFor="amendment-comment">Tu comentario</label>
            <textarea
              id="amendment-comment"
              className="block"
              rows={5}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
            />
            {commentNote !== null && <p role="alert">{commentNote}</p>}
            <button type="button" className="block action-secondary" onClick={() => void submitComment()}>
              {composer.mode === 'edit' ? 'Guardar comentario' : 'Publicar comentario'}
            </button>
            <button type="button" className="block action-secondary" onClick={closeComposer}>
              Cancelar
            </button>
          </div>
        )}
      </section>

      {revisions.length > 0 && (
        <section className="lot" aria-label="Revisiones anteriores">
          <h2>Revisiones anteriores</h2>
          <ol className="lot">
            {revisions.map((r) => (
              <li key={r.revisionNo} className="block">
                <h3>{r.title}</h3>
                <p>
                  Revisión {r.revisionNo} · {todayInColombia(new Date(r.at))}
                </p>
                <Formatted text={r.text} />
                <p>Motivo: {r.motive}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p>
        <Link href="/constitucion/propuestas">Volver a las propuestas</Link>
      </p>
    </article>
  );
}
