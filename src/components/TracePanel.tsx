// RF-19 (021) · 19.1 a 19.4, 19.6, 19.7, RF-1 (010), D-T31 (021) · El panel «Conectar». Quien lo pinta (Play) guarda
// lo elegido y suma o quita ápices al elegirlos en el mapa o en la lista; el panel dice cuántos faltan para tres, avisa
// del tope de diez, lista lo elegido con «Quitar» y, desde tres, muestra el formulario. Si el servidor rechaza, muestra
// el motivo y conserva lo elegido y lo escrito. «Cancelar» no guarda nada.
// «E3 · Celda» (24-11-2026, Propuesta del asistente): sin cajas; «Quitar» y «Cancelar» son enlaces de texto, el texto va como
// cuerpo y cada Ápice elegido, como fila con filete suave. Los avisos conservan su bloque.
import { useId, useState, type FormEvent } from 'react';
import type { Axis } from '../../shared/domain/apice';
import { missingForPath } from '../../shared/domain/commonActions';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';
import { ActionFields } from './CommonActionView';
import './TracePanel.css';

interface Props {
  /** Los ápices elegidos, en orden, con su nombre. */
  chosen: readonly { id: string; name: string }[];
  /** Aviso del tope, si se intentó pasar de diez (RF-19 (021) · 19.4). */
  notice: string | null;
  onRemove: (id: string) => void;
  onCancel: () => void;
  onProposed: (id: string) => void;
  client?: OpClient<ApiOps>;
}

const missingText = (missing: number): string =>
  missing === 0 ? 'Puedes proponerla.' : missing === 1 ? 'Falta 1 ápice.' : `Faltan ${missing} ápices.`;

export function TracePanel({ chosen, notice, onRemove, onCancel, onProposed, client = api }: Props) {
  const session = useSession();
  const ids = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [axis, setAxis] = useState<Axis | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageTitle({ area: 'Acciones Comunes', contentTitle: 'Conectar' });

  if (session.status !== 'person') {
    return (
      <section className="trace-panel">
        <h1 className="c-nombre">Conectar</h1>
        <p className="c-cuerpo">
          Para conectar Ápices, únete a APICCA. <Link href="/solicitar" className="c-enlace">Unirme</Link>
        </p>
      </section>
    );
  }

  const missing = missingForPath(chosen.length);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await client.call('proposeCommonAction', { title, description, axis: axis === '' ? null : axis, apiceIds: chosen.map((apice) => apice.id) });
      onProposed(id);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo proponer la Acción Común. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="trace-panel">
      <h1 className="c-nombre">Conectar</h1>
      <p className="c-cuerpo">Elige en el mapa los Ápices que conecta esta Acción Común.</p>
      <p role="status" className="block">
        {missingText(missing)}
      </p>
      {notice !== null && (
        <p role="alert" className="block">
          {notice}
        </p>
      )}
      {chosen.length > 0 && (
        <ol aria-label="Ápices elegidos" className="trace-panel__chosen">
          {chosen.map((apice) => (
            <li key={apice.id}>
              <span>{apice.name}</span>
              <button type="button" className="c-enlace action-secondary" onClick={() => onRemove(apice.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ol>
      )}
      {missing === 0 ? (
        <ActionFields
          ids={ids}
          title={title}
          description={description}
          axis={axis}
          onTitle={setTitle}
          onDescription={setDescription}
          onAxis={setAxis}
          onSubmit={(event) => void submit(event)}
          onCancel={onCancel}
          busy={busy}
          submitLabel="Proponer"
        />
      ) : (
        <button type="button" className="c-enlace action-secondary" onClick={onCancel}>
          Cancelar
        </button>
      )}
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}
    </section>
  );
}
