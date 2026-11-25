// RF-20 (021) · 20.1 a 20.4, RF-5 (010) · 5.1, 5.2, RF-2 (010), RF-3 (010), RF-7 (010), RF-4 (010) · 4.3, RF-8 (010),
// D-T32 (021) · El panel de una Acción Común sobre el mapa: título, estado, eje, autoría, descripción con formato, quiénes
// participan y los ápices que une (cada uno abre su panel y el mapa lo marca). Las acciones dependen de quién mira:
// sin sesión, el aviso de unirse; quien puede, «Sumarme» o «Retirarme»; la autora, «Editar», cerrar o reabrir y
// «Archivar»; un facilitador, «Archivar». Una que no existe o no se puede leer se ve igual, sin pistas (RF-5 (010) · 5.2).
// Cambiar los ápices de una Acción Común queda para una fase posterior (RF-4 (010) · 4.2, en `pending`).
// «E3 · Celda» (24-11-2026, Propuesta del asistente): sin caja. Rótulo suave con el estado, nombre, línea de ejes, autoría,
// descripción, participantes y Ápices como datos y filas (`.c-dato`, `.c-fila`), «Sumarme» como rótulo grande (`.c-barra`) y
// el resto de acciones como enlaces de texto (`.c-enlace`). Tras el título y la autoría va el Arco (`PiezaArco`, 329 × 120) con las
// celdas de los Ápices que une, si se conoce la forma de al menos dos. El GamePanel pone la línea de sección con «Cerrar».
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { AXES, type Axis, type ApiceStatus } from '../../shared/domain/apice';
import {
  canArchive,
  canJoin,
  canLeave,
  canManage,
  COMMON_ACTION_LIMITS,
  type CommonActionStatus,
  type CommonActionViewer,
} from '../../shared/domain/commonActions';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';
import { firestoreCommonActionSource, type CommonActionDetail, type CommonActionSource } from '../data/commonActions';
import { AXIS_LABEL } from './AxisIcon';
import { CeldaSuperficie } from './Celda';
import { CeldaHueca, EjesLinea } from './EjesLinea';
import { PiezaArco, type ApicePieza } from './PiezaArco';
import { DocBlocks } from './DocBlocks';
import './CommonActionView.css';

interface Props {
  id: string;
  source?: CommonActionSource;
  client?: OpClient<ApiOps>;
  /** Tras sumarse, retirarse o cambiarla: el mapa vuelve a pedir las Acciones Comunes. */
  onChange?: () => void;
  /** Los ejes y la etapa de cada Ápice que une, para dibujar su celda; sin ellos, la fila lleva una celda hueca. */
  apiceInfo?: ReadonlyMap<string, { axes: readonly Axis[]; status: ApiceStatus }>;
}

const STATUS_LABEL: Record<CommonActionStatus, string> = { abierta: 'Abierta', cerrada: 'Cerrada', archivada: 'Archivada' };
const FAILED = 'No se pudo completar la acción. Inténtalo de nuevo.';
const hiddenText = (count: number): string => `Une además ${count === 1 ? '1 ápice' : `${count} ápices`} que no puedes ver.`;

export function CommonActionView({ id, source = firestoreCommonActionSource, client = api, onChange, apiceInfo }: Props) {
  const session = useSession();
  const [action, setAction] = useState<CommonActionDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  usePageTitle({ area: 'Acciones Comunes', contentTitle: action?.title ?? 'Acción Común' });

  const load = useCallback(async () => {
    try {
      setAction(await source.get(id));
    } catch {
      setAction(null);
    }
  }, [source, id]);

  useEffect(() => {
    setAction(undefined);
    setEditing(false);
    setError(null);
    void load();
  }, [load]);

  if (action === undefined || session.status === 'loading') return <p className="c-cuerpo c-suave">Cargando…</p>;
  if (action === null) {
    return (
      <section className="common-action">
        <h1 className="c-nombre">Acción Común</h1>
        <p className="c-cuerpo">Esta Acción Común no existe.</p>
      </section>
    );
  }

  const viewer: CommonActionViewer | null = session.status === 'person' ? { uid: session.uid, role: session.role, status: 'active' } : null;
  const state = { status: action.status, authorUid: action.authorUid, authorSuspended: false };
  // El Arco de la Acción Común (E3 · Celda): las celdas de sus Ápices con su arco; solo cuando se sabe la forma de al menos dos.
  const piezas: ApicePieza[] = action.apices.flatMap((apice) => {
    const info = apiceInfo?.get(apice.id);
    return info === undefined ? [] : [{ id: apice.id, name: apice.name, axes: [...info.axes], status: info.status }];
  });
  const participates = viewer !== null && action.participantUids.includes(viewer.uid);

  const run = async (call: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await call();
      await load();
      setEditing(false);
      onChange?.();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : FAILED);
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (status: CommonActionStatus) => run(() => client.call('setCommonActionStatus', { actionId: id, status }));

  return (
    <article className="common-action">
      <header className="common-action__head">
        <p className="common-action__status c-rot c-suave" data-status={action.status}>
          {STATUS_LABEL[action.status]}
        </p>
        <h1 className="c-nombre">{action.title}</h1>
        {action.axis !== null && <EjesLinea ejes={[action.axis]} />}
        <p className="c-cuerpo c-suave">Propuesta por @{action.authorUsername}</p>
      </header>
      {!editing && piezas.length >= 2 && (
        <div className="common-action__arco">
          <PiezaArco apices={piezas} ancho={329} alto={120} cel={44} eje={action.axis} cerrada={action.status === 'cerrada'} />
        </div>
      )}
      {editing ? (
        <EditForm action={action} busy={busy} onCancel={() => setEditing(false)} onSave={(fields) => run(() => client.call('editCommonAction', { actionId: id, ...fields }))} />
      ) : (
        <div className="common-action__descripcion c-cuerpo">
          <DocBlocks blocks={parseMarkdown(action.description)} />
        </div>
      )}
      <div className="common-action__datos">
        <div className="c-dato c-dato--columna">
          <h2 className="c-rot" id={`${id}-participants`}>
            Participantes ({action.participants.length})
          </h2>
          <ul aria-label={`Participantes (${action.participants.length})`} className="common-action__people c-cuerpo">
            {action.participants.map((person) => (
              <li key={person.uid}>@{person.username}</li>
            ))}
          </ul>
        </div>
        <div className="c-dato c-dato--columna">
          <h2 className="c-rot">Ápices que une</h2>
          <ul aria-label="Ápices que une" className="common-action__apices">
            {action.apices.map((apice) => {
              const info = apiceInfo?.get(apice.id);
              return (
                <li key={apice.id}>
                  <Link href={`/apices/${apice.id}`} className="c-fila c-fila--tocable">
                    {info === undefined ? <CeldaHueca /> : <CeldaSuperficie axes={info.axes} status={info.status} ancho={28} />}
                    <span className="c-nm">{apice.name}</span>
                    <span className="c-rot c-suave" aria-hidden="true">
                      {apice.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {action.hiddenApices > 0 && <p className="c-cuerpo c-suave">{hiddenText(action.hiddenApices)}</p>}
        </div>
      </div>
      {session.status === 'visitor' && action.status === 'abierta' && (
        <p className="block">
          Para sumarte a esta Acción Común, únete a APICCA. <Link href="/solicitar" className="enlace-texto">Unirme</Link>
        </p>
      )}
      {!editing && (
        <div className="common-action__actions">
          {!participates && canJoin(viewer, state) && (
            <button type="button" className="c-barra action-primary" disabled={busy} onClick={() => void run(() => client.call('joinCommonAction', { actionId: id }))}>
              Sumarme
            </button>
          )}
          <div className="common-action__enlaces">
            {participates && canLeave(viewer, state) && (
              <button type="button" className="c-enlace action-secondary" disabled={busy} onClick={() => void run(() => client.call('leaveCommonAction', { actionId: id }))}>
                Retirarme
              </button>
            )}
            {canManage(viewer, state) && (
              <>
                <button type="button" className="c-enlace action-secondary" disabled={busy} onClick={() => setEditing(true)}>
                  Editar
                </button>
                <button type="button" className="c-enlace action-secondary" disabled={busy} onClick={() => void setStatus(action.status === 'abierta' ? 'cerrada' : 'abierta')}>
                  {action.status === 'abierta' ? 'Cerrar Acción Común' : 'Reabrir Acción Común'}
                </button>
              </>
            )}
            {canArchive(viewer, state) && (
              <button type="button" className="c-enlace c-enlace--destructiva action-secondary" disabled={busy} onClick={() => void setStatus('archivada')}>
                Archivar
              </button>
            )}
          </div>
        </div>
      )}
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}
    </article>
  );
}

interface EditFields {
  title: string;
  description: string;
  axis: Axis | null;
}

/** RF-7 (010) · 7.3, D-T32 (021): título, descripción y eje; los ápices no se cambian aquí. */
function EditForm({ action, busy, onSave, onCancel }: { action: CommonActionDetail; busy: boolean; onSave: (fields: EditFields) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(action.title);
  const [description, setDescription] = useState(action.description);
  const [axis, setAxis] = useState<Axis | ''>(action.axis ?? '');
  const ids = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ title, description, axis: axis === '' ? null : axis });
  };
  return <ActionFields ids={ids} title={title} description={description} axis={axis} onTitle={setTitle} onDescription={setDescription} onAxis={setAxis} onSubmit={submit} busy={busy} submitLabel="Guardar" onCancel={onCancel} />;
}

export interface ActionFieldsProps {
  ids: string;
  title: string;
  description: string;
  axis: Axis | '';
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onAxis: (value: Axis | '') => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
}

/** Los campos de una Acción Común, con las etiquetas encima (RF-13 (019)): los usan «Editar» y «Conectar». */
export function ActionFields({ ids, title, description, axis, onTitle, onDescription, onAxis, onSubmit, onCancel, busy, submitLabel }: ActionFieldsProps) {
  return (
    <form className="common-action__form" onSubmit={onSubmit}>
      <label htmlFor={`${ids}-title`} className="c-rot">Título</label>
      <input
        id={`${ids}-title`}
        className="block"
        value={title}
        required
        minLength={COMMON_ACTION_LIMITS.titleMin}
        maxLength={COMMON_ACTION_LIMITS.title}
        onChange={(event) => onTitle(event.target.value)}
      />
      <label htmlFor={`${ids}-description`} className="c-rot">Descripción</label>
      <textarea
        id={`${ids}-description`}
        className="block"
        value={description}
        required
        minLength={COMMON_ACTION_LIMITS.descriptionMin}
        maxLength={COMMON_ACTION_LIMITS.description}
        rows={5}
        onChange={(event) => onDescription(event.target.value)}
      />
      <label htmlFor={`${ids}-axis`} className="c-rot">Eje principal (opcional)</label>
      <select id={`${ids}-axis`} className="block" value={axis} onChange={(event) => onAxis(event.target.value as Axis | '')}>
        <option value="">Sin eje</option>
        {AXES.map((option) => (
          <option key={option} value={option}>
            {AXIS_LABEL[option]}
          </option>
        ))}
      </select>
      <div className="common-action__actions">
        <button type="submit" className="c-barra action-primary" disabled={busy}>
          {submitLabel}
        </button>
        <button type="button" className="c-enlace action-secondary" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
