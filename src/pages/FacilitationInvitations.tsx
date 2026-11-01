// RF-1 (001), RF-8 (016) · 8.1, RF-6 (002) · 6.1, 6.3, RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1 · Invitaciones: invitar un correo, ver y copiar el enlace de las pendientes, renovar y anular.
import { useMemo, useState, type FormEvent } from 'react';
import {
  compareInvitations,
  INVITATION_STATE_LABELS,
  invitationState,
  type InvitationState,
} from '../../shared/domain/invitations';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreFacilitationSource, type FacilitationSource, type InvitationRow } from '../data/facilitation';
import { errorText, FacilitationShell, LinkBox, useRows } from './FacilitationShell';

interface Props {
  source?: FacilitationSource;
  client?: OpClient<ApiOps>;
  now?: () => Date;
}

type Outcome = { kind: 'link'; email: string; link: string } | { kind: 'error'; text: string } | null;

export function FacilitationInvitations({ source = firestoreFacilitationSource, client = api, now = () => new Date() }: Props) {
  return (
    <FacilitationShell title="Invitaciones">
      {() => <Invitations source={source} client={client} now={now} />}
    </FacilitationShell>
  );
}

function Invitations({ source, client, now }: Required<Props>) {
  const { rows, failed } = useRows(source.onInvitations);
  const [email, setEmail] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => [...(rows ?? [])].sort(compareInvitations), [rows]);

  const issue = async (target: string): Promise<boolean> => {
    setBusy(true);
    try {
      const { link } = await client.call('invite', { email: target });
      setOutcome({ kind: 'link', email: target, link });
      return true;
    } catch (error) {
      setOutcome({ kind: 'error', text: errorText(error) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await issue(email)) setEmail('');
  };

  const cancel = async (target: string) => {
    setBusy(true);
    try {
      await client.call('cancelInvitation', { email: target });
      setOutcome(null);
    } catch (error) {
      setOutcome({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="lot">
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Correo
            <input className="block" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button type="submit" className="block action-primary" disabled={busy}>
            Invitar
          </button>
        </form>
      </div>
      {outcome?.kind === 'error' ? <p role="alert" className="block">{outcome.text}</p> : null}
      {outcome?.kind === 'link' ? (
        <p role="status" className="block">
          Enlace para {outcome.email}: <LinkBox path={outcome.link} />
        </p>
      ) : null}
      {failed ? <p role="alert" className="block">No se pudo leer la lista.</p> : null}
      {rows === null ? null : (
        <div className="lot">
          {sorted.length === 0 ? (
            <p className="block block-empty">Aún no hay invitaciones.</p>
          ) : (
            <ul>
              {sorted.map((invitation) => (
                <InvitationItem
                  key={invitation.email}
                  invitation={invitation}
                  state={invitationState(invitation, now())}
                  busy={busy}
                  onRenew={() => void issue(invitation.email)}
                  onCancel={() => void cancel(invitation.email)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function InvitationItem({
  invitation,
  state,
  busy,
  onRenew,
  onCancel,
}: {
  invitation: InvitationRow;
  state: InvitationState;
  busy: boolean;
  onRenew: () => void;
  onCancel: () => void;
}) {
  return (
    <li className="block">
      {invitation.email} <strong>{INVITATION_STATE_LABELS[state]}</strong>{' '}
      {state === 'pending' ? (
        invitation.token !== undefined ? (
          <LinkBox path={`/registro/${invitation.token}`} />
        ) : (
          <span>Para compartir de nuevo el enlace, renueva la invitación.</span>
        )
      ) : null}{' '}
      {state !== 'accepted' ? (
        <button type="button" className="block action-secondary" disabled={busy} onClick={onRenew}>
          Renovar
        </button>
      ) : null}
      {state === 'pending' || state === 'expired' ? (
        <button type="button" className="block action-secondary" disabled={busy} onClick={onCancel}>
          Anular
        </button>
      ) : null}
    </li>
  );
}
