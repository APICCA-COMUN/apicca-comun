// RF-5 (001), RF-6 (002) · 6.1, 6.3; RF-4 (003) · 4.6, RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1 · Cuentas: suspender y reactivar (secundarias). No se ofrece suspender a quien facilita ni a la propia cuenta.
import { useMemo, useState } from 'react';
import { canSuspend } from '../../shared/domain/access';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreFacilitationSource, type FacilitationSource } from '../data/facilitation';
import { errorText, FacilitationShell, useRows } from './FacilitationShell';

interface Props {
  source?: FacilitationSource;
  client?: OpClient<ApiOps>;
}

export function FacilitationAccounts({ source = firestoreFacilitationSource, client = api }: Props) {
  return (
    <FacilitationShell title="Cuentas">
      {(session) => <Accounts source={source} client={client} self={{ uid: session.uid, role: session.role }} />}
    </FacilitationShell>
  );
}

function Accounts({ source, client, self }: Required<Props> & { self: { uid: string; role: 'member' | 'facilitator' } }) {
  const { rows, failed } = useRows(source.onAccounts);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => a.username.localeCompare(b.username)), [rows]);

  const change = async (op: 'suspendAccount' | 'reactivateAccount', uid: string) => {
    setBusy(true);
    try {
      await client.call(op, { uid });
      setError(null);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error === null ? null : <p role="alert" className="block">{error}</p>}
      {failed ? <p role="alert" className="block">No se pudo leer la lista.</p> : null}
      <div className="lot">
        <ul>
          {sorted.map((account) => (
            <li key={account.uid} className="block">
              <strong>{account.username}</strong> {account.name} ({account.email}){' '}
              {account.role === 'facilitator' ? 'Facilita · ' : ''}
              <span>{account.status === 'active' ? 'Activa' : 'Suspendida'}</span>{' '}
              {account.status === 'suspended' ? (
                <button type="button" className="block action-secondary" disabled={busy} onClick={() => void change('reactivateAccount', account.uid)}>
                  Reactivar
                </button>
              ) : canSuspend(self, account).ok ? (
                <button type="button" className="block action-secondary" disabled={busy} onClick={() => void change('suspendAccount', account.uid)}>
                  Suspender
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
