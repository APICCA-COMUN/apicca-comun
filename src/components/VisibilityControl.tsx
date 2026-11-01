// RF-13 (001), RF-6 (002), RF-13 (002) · 13.1, 13.3 · Control de visibilidad de la ficha: hace público o privado un ápice. Quien lo muestra decide
// con `canChangeVisibility` si la persona puede verlo; la op lo vuelve a comprobar en el servidor.
// Hacer privado y hacer público son secundarias: la 001 no les pide confirmación ni motivo (RF-6 (002) · 6.3).
import { useState } from 'react';
import type { Visibility } from '../../shared/domain/apice';
import { ConditionTag } from './ConditionTag';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';

interface Props {
  id: string;
  visibility: Visibility;
  client?: OpClient<ApiOps>;
}

export function VisibilityControl({ id, visibility, client = api }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target: Visibility = visibility === 'public' ? 'private' : 'public';

  const change = async () => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await client.call('setVisibility', { id, visibility: target });
      setNotice(target === 'public' ? 'El ápice ahora es público.' : 'El ápice ahora es privado.');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo cambiar la visibilidad. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Visibilidad">
      <p>
        Este ápice es <ConditionTag condition="visibility">{visibility === 'public' ? 'público' : 'privado'}</ConditionTag>
        {visibility === 'public' ? ': cualquier persona lo ve.' : ': solo lo ven las cuentas con sesión.'}
        {visibility === 'public' ? ' Si lo haces privado, dejará de verse para quien no tenga sesión.' : ''}
      </p>
      <button
        type="button"
        className="block action-secondary"
        disabled={busy}
        onClick={() => void change()}
      >
        {target === 'public' ? 'Hacer público' : 'Hacer privado'}
      </button>
      {notice === null ? null : <p role="status" className="block">{notice}</p>}
      {error === null ? null : <p role="alert" className="block">{error}</p>}
    </section>
  );
}
