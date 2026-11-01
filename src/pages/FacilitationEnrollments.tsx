// RF-4 (001), RF-6 (002) · 6.1, 6.3; RF-4 (003) · 4.6, RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1 · Solicitudes de inscripción: pendientes y resueltas, aceptar (secundaria, crea la invitación) y descartar con motivo.
import { useMemo, useState } from 'react';
import { splitEnrollmentLists, validateDiscardReason } from '../../shared/domain/enrollment';
import { messageFor } from '../../shared/domain/messages';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreFacilitationSource, type EnrollmentRow, type FacilitationSource } from '../data/facilitation';
import { errorText, FacilitationShell, LinkBox, useRows } from './FacilitationShell';

interface Props {
  source?: FacilitationSource;
  client?: OpClient<ApiOps>;
}

type Outcome = { kind: 'link'; link: string } | { kind: 'info'; text: string } | { kind: 'error'; text: string } | null;

export function FacilitationEnrollments({ source = firestoreFacilitationSource, client = api }: Props) {
  return <FacilitationShell title="Solicitudes">{() => <Enrollments source={source} client={client} />}</FacilitationShell>;
}

function Enrollments({ source, client }: Required<Props>) {
  const { rows, failed } = useRows(source.onEnrollments);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const lists = useMemo(() => splitEnrollmentLists(rows ?? []), [rows]);

  const run = async (payload: ApiOps['resolveEnrollment']['in']) => {
    setBusy(true);
    try {
      const result = await client.call('resolveEnrollment', payload);
      if ('link' in result) setOutcome({ kind: 'link', link: result.link });
      else if ('accountExists' in result) {
        setOutcome({ kind: 'info', text: `${messageFor('account-exists')} La solicitud sigue pendiente.` });
      } else setOutcome(null);
      setDiscarding(null);
      setReason('');
    } catch (error) {
      setOutcome({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscard = (id: string) => {
    const checked = validateDiscardReason(reason);
    if (!checked.ok) {
      setOutcome({ kind: 'error', text: messageFor(checked.code) });
      return;
    }
    void run({ id, decision: 'discard', reason });
  };

  return (
    <>
      {outcome?.kind === 'error' ? <p role="alert" className="block">{outcome.text}</p> : null}
      {outcome?.kind === 'info' ? <p role="status" className="block">{outcome.text}</p> : null}
      {outcome?.kind === 'link' ? (
        <p role="status" className="block">
          Invitación creada: <LinkBox path={outcome.link} />
        </p>
      ) : null}
      {failed ? <p role="alert" className="block">No se pudo leer la lista.</p> : null}
      <section aria-labelledby="pending-title" className="lot">
        <h3 id="pending-title">Pendientes</h3>
        <RequestList
          rows={lists.pending}
          empty="No hay solicitudes pendientes."
          renderActions={(request) =>
            discarding === request.id ? (
              <span>
                <label>
                  Motivo
                  <textarea className="block" value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" className="block action-destructive" disabled={busy} onClick={() => confirmDiscard(request.id)}>
                  Confirmar descarte
                </button>
              </span>
            ) : (
              <span>
                <button type="button" className="block action-secondary" disabled={busy} onClick={() => void run({ id: request.id, decision: 'accept' })}>
                  Aceptar
                </button>
                <button type="button" className="block action-destructive" disabled={busy} onClick={() => setDiscarding(request.id)}>
                  Descartar
                </button>
              </span>
            )
          }
        />
      </section>
      <section aria-labelledby="resolved-title" className="lot">
        <h3 id="resolved-title">Resueltas</h3>
        <RequestList
          rows={lists.resolved}
          empty="Aún no hay solicitudes resueltas."
          renderActions={(request) => (
            <span>
              {request.status === 'accepted' ? 'Aceptada' : 'Descartada'}
              {request.reason ? ` · Motivo: ${request.reason}` : ''}
            </span>
          )}
        />
      </section>
    </>
  );
}

function RequestList({
  rows,
  empty,
  renderActions,
}: {
  rows: EnrollmentRow[];
  empty: string;
  renderActions: (request: EnrollmentRow) => React.ReactNode;
}) {
  if (rows.length === 0) return <p className="block block-empty">{empty}</p>;
  return (
    <ul>
      {rows.map((request) => (
        <li key={request.id} className="block">
          <strong>{request.name}</strong> ({request.email})
          <p>{request.message}</p>
          {renderActions(request)}
        </li>
      ))}
    </ul>
  );
}
