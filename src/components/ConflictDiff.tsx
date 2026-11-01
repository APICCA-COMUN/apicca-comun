// RF-11 (001), RF-6 (002), RF-2 (002) · Conflicto de edición: muestra campo por campo lo vigente frente a lo propio y deja
// conservar lo propio (se reenvía sobre la versión vigente) o descartarlo. La diferencia se dice con texto, sin depender del color.
import type { ReactNode } from 'react';
import { diffContent, type ContentChange, type EditableFields } from '../../shared/domain/versions';
import { AXIS_LABEL } from './AxisPicker';
import './ConflictDiff.css';

interface ConflictDiffProps {
  /** Lo que la persona quiere guardar. */
  mine: EditableFields;
  /** Lo que hay guardado ahora. */
  current: EditableFields;
  onKeepMine: () => void;
  onDiscard: () => void;
  busy?: boolean;
}

const LABEL: Record<ContentChange['field'], string> = {
  name: 'Nombre',
  description: 'Descripción',
  axes: 'Ejes',
  needs: 'Necesidades',
  offers: 'Aportes',
  status: 'Estado',
};

const names = (axes: readonly (keyof typeof AXIS_LABEL)[]): string => axes.map((axis) => AXIS_LABEL[axis]).join(', ');

function Change({ change }: { change: ContentChange }): ReactNode {
  if (change.field === 'axes') {
    return (
      <>
        {change.added.length > 0 && <p>{`Agregas: ${names(change.added)}.`}</p>}
        {change.removed.length > 0 && <p>{`Quitas: ${names(change.removed)}.`}</p>}
      </>
    );
  }
  const show = (text: string): string => (text === '' ? '(vacío)' : text);
  return (
    <>
      <p>
        <span>Vigente: </span>
        <span className="conflict-text">{show(change.before)}</span>
      </p>
      <p>
        <span>Tuyo: </span>
        <span className="conflict-text">{show(change.after)}</span>
      </p>
    </>
  );
}

export function ConflictDiff({ mine, current, onKeepMine, onDiscard, busy = false }: ConflictDiffProps) {
  const changes = diffContent(current, mine);
  return (
    <section aria-labelledby="conflict-title">
      <h2 id="conflict-title">Hay un conflicto</h2>
      <p role="alert" className="block">Alguien más guardó cambios en este ápice mientras editabas.</p>
      {changes.length === 0 ? (
        <p>Tus cambios coinciden con lo guardado.</p>
      ) : (
        changes.map((change) => (
          <fieldset key={change.field}>
            <legend>{LABEL[change.field]}</legend>
            <Change change={change} />
          </fieldset>
        ))
      )}
      <button type="button" className="block action-primary" onClick={onKeepMine} disabled={busy}>
        Conservar los míos
      </button>
      <button type="button" className="block action-secondary" onClick={onDiscard} disabled={busy}>
        Descartar
      </button>
    </section>
  );
}
