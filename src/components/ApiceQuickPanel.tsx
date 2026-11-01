// RF-7 (005) · 7.1 a 7.8, 7.10, 7.12, D-7 (005), D-10 (005), D-T6 (005) · Panel lateral del lote: la ficha resumida del
// ápice elegido y, para quien puede editarlo (RF-10 (001)), «Editar ápice» con la edición rápida de nombre, descripción, ejes y estado. Guarda con
// `editApice` sobre la versión que leyó, con las necesidades y los aportes del documento y sin tocar la ubicación;
// un conflicto se resuelve con `ConflictDiff` (RF-11 (001)). Avisa si hay cambios sin guardar y si la edición se ve.
import { useEffect, useState, type FormEvent } from 'react';
import { APICE_STATUSES, AXES, validateContent, type ApiceStatus, type Axis, type ContentField } from '../../shared/domain/apice';
import { canEdit, canSeeHistory } from '../../shared/domain/access';
import type { EditableFields } from '../../shared/domain/versions';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreApiceSource, type ApiceDoc, type ApiceSource, type ListedApice } from '../data/apices';
import { AXIS_LABEL, AxisBadge, AxisIcon } from './AxisIcon';
import { ConflictDiff } from './ConflictDiff';
import { issueText, saveFailureText } from './ContentForm';
import { PixelImage } from './PixelImage';
import './ApiceQuickPanel.css';

/** Lo que la edición rápida cambia. */
export type QuickFields = Pick<ListedApice, 'name' | 'description' | 'axes' | 'status'>;

interface Props {
  apice: ListedApice;
  source?: ApiceSource;
  client?: OpClient<ApiOps>;
  /** Tras guardar, con los datos nuevos, para actualizar el edificio y la fila (RF-7 (005) · 7.8). */
  onSaved?(id: string, fields: QuickFields): void;
  onDirtyChange?(dirty: boolean): void;
  onEditingChange?(editing: boolean): void;
}

export function ApiceQuickPanel({ apice, source = firestoreApiceSource, client = api, onSaved, onDirtyChange, onEditingChange }: Props) {
  const session = useSession();
  const person = session.status === 'person' ? session : null;
  const [stored, setStored] = useState<ApiceDoc | null>(null);

  // Solo quien tiene sesión activa lee el documento: lo necesita para la versión y el permiso (D-T6 (005)).
  useEffect(() => {
    setStored(null);
    if (person === null) return undefined;
    return source.onApice(apice.id, setStored);
  }, [source, apice.id, person?.uid]);

  const viewer = person && { uid: person.uid, role: person.role, status: 'active' as const };
  const editable = stored !== null && canEdit(viewer, stored);
  const history = stored !== null && canSeeHistory(viewer, stored);

  useEffect(() => {
    onEditingChange?.(editable);
  }, [editable]);
  useEffect(() => () => onEditingChange?.(false), []);

  return (
    <aside className="block apice-panel" aria-label="Ápice elegido">
      <div className="apice-panel__image">
        <PixelImage image={apice.image} side={128} />
      </div>
      {editable ? (
        <h2>Editar ápice</h2>
      ) : (
        <>
          <h2>{apice.name}</h2>
          <p className="apice-panel__description">{apice.description}</p>
          <p className="apice-panel__axes">
            {AXES.filter((axis) => apice.axes.includes(axis)).map((axis) => (
              <AxisBadge key={axis} axis={axis} />
            ))}
          </p>
          <p className="apice-panel__status">{apice.status}</p>
        </>
      )}
      {editable && (
        <QuickEdit
          id={apice.id}
          stored={stored}
          client={client}
          onSaved={onSaved}
          onDirtyChange={onDirtyChange}
          historyHref={history ? `/apices/${apice.id}/historial` : null}
        />
      )}
      <p className="apice-panel__links">
        <Link href={`/apices/${apice.id}`}>Ver ficha</Link>
        {history && !editable && <Link href={`/apices/${apice.id}/historial`}>Ver historial</Link>}
        {editable && <Link href={`/apices/${apice.id}/editar`}>Editar todo</Link>}
      </p>
    </aside>
  );
}

const quickOf = (fields: QuickFields): QuickFields => ({
  name: fields.name,
  description: fields.description,
  axes: [...fields.axes],
  status: fields.status,
});

const same = (a: QuickFields, b: QuickFields): boolean =>
  a.name === b.name && a.description === b.description && a.status === b.status && a.axes.join() === b.axes.join();

interface Conflict {
  mine: EditableFields;
  current: { version: number; content: EditableFields };
}

interface QuickEditProps {
  id: string;
  stored: ApiceDoc;
  client: OpClient<ApiOps>;
  onSaved: Props['onSaved'];
  onDirtyChange: Props['onDirtyChange'];
  historyHref: string | null;
}

function QuickEdit({ id, stored, client, onSaved, onDirtyChange, historyHref }: QuickEditProps) {
  // La base no se mueve con los cambios que lleguen mientras se edita (RF-11 (001)).
  const [base, setBase] = useState(() => ({ version: stored.version, values: quickOf(stored), rest: { needs: stored.needs, offers: stored.offers } }));
  const [values, setValues] = useState<QuickFields>(base.values);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const dirty = !same(values, base.values);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty]);

  const validation = validateContent({ ...values, ...base.rest });
  const issues = validation.ok ? [] : validation.issues.filter((issue) => submitted || issue.code !== 'field-required');
  const issueFor = (field: ContentField) => issues.find((issue) => issue.field === field);

  /** Guarda sobre `version`; el conflicto queda en el estado y el error, al que llama. */
  const send = async (content: EditableFields, version: number): Promise<void> => {
    const result = await client.call('editApice', { id, baseVersion: version, content });
    if (!result.ok) {
      setConflict({ mine: content, current: result.current });
      return;
    }
    const saved = quickOf(content);
    setBase({ version: result.version, values: saved, rest: { needs: content.needs, offers: content.offers } });
    setValues(saved);
    setSubmitted(false);
    setConflict(null);
    onSaved?.(id, saved);
  };

  const attempt = async (run: () => Promise<void>): Promise<void> => {
    setSending(true);
    setFailure(null);
    try {
      await run();
    } catch (error) {
      setFailure(saveFailureText(error));
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setSubmitted(true);
    if (!validation.ok) return;
    const content: EditableFields = { ...validation.value, status: values.status };
    void attempt(() => send(content, base.version));
  };

  if (conflict !== null) {
    const discard = (): void => {
      const current = quickOf(conflict.current.content);
      setBase({ version: conflict.current.version, values: current, rest: { needs: conflict.current.content.needs, offers: conflict.current.content.offers } });
      setValues(current);
      setConflict(null);
      setFailure(null);
    };
    return (
      <div className="apice-panel__edit">
        <ConflictDiff
          mine={conflict.mine}
          current={conflict.current.content}
          onKeepMine={() => void attempt(() => send(conflict.mine, conflict.current.version))}
          onDiscard={discard}
          busy={sending}
        />
        {failure !== null && <p role="alert" className="block">{failure}</p>}
      </div>
    );
  }

  const text = (field: 'name' | 'description') => {
    const issue = issueFor(field);
    const fieldId = `quick-${id}-${field}`;
    return {
      id: fieldId,
      className: 'block',
      value: values[field],
      'aria-invalid': issue !== undefined,
      'aria-describedby': issue === undefined ? undefined : `${fieldId}-error`,
      onChange: (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value }),
    };
  };
  const toggle = (axis: Axis): void =>
    setValues({ ...values, axes: AXES.filter((candidate) => (candidate === axis ? !values.axes.includes(axis) : values.axes.includes(candidate))) });
  const axesIssue = issueFor('axes');

  return (
    <form className="apice-panel__edit" onSubmit={submit} noValidate>
      {(['name', 'description'] as const).map((field) => {
        const props = text(field);
        const issue = issueFor(field);
        return (
          <div key={field}>
            <label htmlFor={props.id}>{field === 'name' ? 'Nombre' : 'Descripción'}</label>
            {field === 'name' ? <input type="text" {...props} /> : <textarea {...props} />}
            {issue !== undefined && <p id={`${props.id}-error`}>{issueText(issue)}</p>}
          </div>
        );
      })}
      <fieldset className="apice-panel__pills" aria-describedby={axesIssue ? `quick-${id}-axes-error` : undefined}>
        <legend>Ejes</legend>
        {AXES.map((axis) => (
          <button key={axis} type="button" className="block action-secondary" aria-pressed={values.axes.includes(axis)} onClick={() => toggle(axis)}>
            <AxisIcon axis={axis} size={20} />
            {AXIS_LABEL[axis]}
          </button>
        ))}
      </fieldset>
      {axesIssue !== undefined && <p id={`quick-${id}-axes-error`}>{issueText(axesIssue)}</p>}
      <fieldset className="apice-panel__segments" role="radiogroup" aria-labelledby={`quick-${id}-status`}>
        <legend id={`quick-${id}-status`}>Estado</legend>
        {APICE_STATUSES.map((status) => (
          <label key={status}>
            <input
              type="radio"
              className="choice"
              name={`quick-${id}-status`}
              value={status}
              checked={values.status === status}
              onChange={() => setValues({ ...values, status: status as ApiceStatus })}
            />
            {status}
          </label>
        ))}
      </fieldset>
      {failure !== null && <p role="alert" className="block">{failure}</p>}
      <div className="apice-panel__actions">
        <button type="submit" className="block action-primary" disabled={sending}>
          Guardar cambios
        </button>
        {historyHref !== null && <Link href={historyHref}>Ver historial</Link>}
      </div>
    </form>
  );
}
