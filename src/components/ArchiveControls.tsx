// RF-14 (001), RF-6 (002), RF-13 (002) · 13.1, 13.3 · Archivar y restaurar desde la ficha, con el aviso «archivado». Un ápice archivado solo admite
// restaurar. Quien lo muestra decide con `canArchive` si la persona lo ve.
// Archivar y restaurar son secundarias: la 001 no les pide confirmación ni motivo (RF-6 (002) · 6.3).
import { useState } from 'react';
import { ConditionTag } from './ConditionTag';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';

interface Props {
  id: string;
  isArchived: boolean;
  client?: OpClient<ApiOps>;
}

export function ArchiveControls({ id, isArchived, client = api }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (op: 'archiveApice' | 'restoreApice') => {
    setBusy(true);
    setError(null);
    try {
      await client.call(op, { id });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo completar la acción. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Archivo">
      {isArchived ? (
        <>
          <p role="status" className="block">Este ápice está <ConditionTag condition="archived">archivado</ConditionTag>: no se puede editar ni cambiar su visibilidad.</p>
          <button type="button" className="block action-secondary" disabled={busy} onClick={() => void run('restoreApice')}>
            Restaurar
          </button>
        </>
      ) : (
        <button type="button" className="block action-secondary" disabled={busy} onClick={() => void run('archiveApice')}>
          Archivar
        </button>
      )}
      {error === null ? null : <p role="alert" className="block">{error}</p>}
    </section>
  );
}
