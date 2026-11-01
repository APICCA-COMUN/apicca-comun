// RF-3 (009) · 3.1, 3.2 · «Abrir un hilo»: título, eje y primer mensaje. Valida con el dominio antes de enviar y muestra
// el motivo del servidor si lo rechaza; lo escrito se conserva.
import { useState, type FormEvent } from 'react';
import { AXES, type Axis } from '../../shared/domain/apice';
import { axisName, validateMessage, validateThreadTitle } from '../../shared/domain/forum';
import { ApiClientError } from '../data/api';

export interface ThreadFormValues {
  title: string;
  axis: Axis;
  text: string;
}

interface Props {
  onSubmit(values: ThreadFormValues): Promise<void>;
  onCancel(): void;
}

export function ThreadForm({ onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [axis, setAxis] = useState<Axis>(AXES[0]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = [validateThreadTitle(title), validateMessage(text)].find((check) => !check.ok);
    if (problem !== undefined) {
      setError(problem.reason ?? null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ title, axis, text });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'No se pudo abrir el hilo. Inténtalo de nuevo; lo escrito se conservó.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="block thread-form" aria-label="Abrir un hilo" noValidate onSubmit={(event) => void submit(event)}>
      <label>
        Título
        <input className="block" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Eje
        <select className="block" value={axis} onChange={(event) => setAxis(event.target.value as Axis)}>
          {AXES.map((value) => (
            <option key={value} value={value}>
              {axisName(value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mensaje
        <textarea className="block" rows={4} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}
      <div className="thread-form__actions">
        <button type="submit" className="block action-primary" disabled={busy} aria-busy={busy}>
          Publicar hilo
        </button>
        <button type="button" className="block action-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
