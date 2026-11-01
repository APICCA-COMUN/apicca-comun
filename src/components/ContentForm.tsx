// RF-6 (001), RF-7 (001), RF-8 (001), RF-9 (001), RNF-10 (001) · Formulario de la ficha de un ápice: valida con el dominio,
// dice cuántos caracteres sobran, conserva lo escrito como borrador y no interpreta marcas (texto plano).
// RF-6 (002) · 6.1, 6.3: campos y aviso como bloques; el envío es la acción principal.
import { useState, type ComponentType, type FormEvent } from 'react';
import { APICE_STATUSES, INITIAL_APICE_STATUS, validateContent, type ApiceStatus, type Axis, type ContentField, type ContentIssue } from '../../shared/domain/apice';
import { AXES } from '../../shared/domain/apice';
import { LIMITS } from '../../shared/domain/limits';
import type { Location, Point } from '../../shared/domain/location';
import { messageFor } from '../../shared/domain/messages';
import { useDrafts } from '../app/drafts';
import { ApiClientError, type LocationEdit } from '../data/api';
import { AxisPicker } from './AxisPicker';
import { KEEP_LOCATION, resolveLocationDraft, restoreLocationDraft, type LocationDraft } from './locationDraft';
import { LocationPicker, type PointMapProps } from './LocationPicker';

export interface FormValues {
  name: string;
  description: string;
  axes: Axis[];
  needs: string;
  offers: string;
  status: ApiceStatus;
}

export const EMPTY_VALUES: FormValues = { name: '', description: '', axes: [], needs: '', offers: '', status: INITIAL_APICE_STATUS };

/** Con esto el formulario ofrece la ubicación (RF-9 (001)); sin esto no la muestra ni la envía. */
export interface LocationOptions {
  /** Ubicación de pantalla guardada; `null` si no hay. */
  stored: Location | null;
  /** Punto exacto guardado: solo se pasa a la autora y a la facilitación. */
  exact?: Point | undefined;
  /** Mapa para marcar el punto; `null` deja solo las coordenadas. */
  map?: ComponentType<PointMapProps> | null | undefined;
  /** Si puede fijar un punto o volver exacta la ubicación (RF-1 (016)); por omisión, sí. */
  mayRaise?: boolean | undefined;
}

interface ContentFormProps {
  initial: FormValues;
  /** Clave del borrador: `apice:new` o `apice:<id>`. */
  draftKey: string;
  submitLabel: string;
  /** Recibe el contenido ya validado y normalizado y, si el formulario ofrece ubicación, qué hacer con ella. Si rechaza, el formulario muestra el error y conserva el texto. */
  onSubmit: (values: FormValues, location?: LocationEdit) => Promise<void>;
  showStatus?: boolean;
  location?: LocationOptions;
}

const TEXT_FIELDS = [
  { field: 'name', label: 'Nombre', limit: LIMITS.title, multiline: false },
  { field: 'description', label: 'Descripción', limit: LIMITS.text, multiline: true },
  { field: 'needs', label: 'Necesidades', limit: LIMITS.text, multiline: true },
  { field: 'offers', label: 'Aportes', limit: LIMITS.text, multiline: true },
] as const;

const REQUIRED: Partial<Record<ContentField, string>> = {
  name: 'Escribe el nombre del ápice.',
  description: 'Escribe la descripción del ápice.',
  axes: 'Elige al menos un eje.',
};

function restore(raw: string | undefined, fallback: FormValues): FormValues {
  if (raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<FormValues>;
    const axes = Array.isArray(parsed.axes) ? AXES.filter((axis) => parsed.axes?.includes(axis)) : fallback.axes;
    const status = APICE_STATUSES.find((candidate) => candidate === parsed.status) ?? fallback.status;
    const text = (value: unknown, other: string): string => (typeof value === 'string' ? value : other);
    return {
      name: text(parsed.name, fallback.name),
      description: text(parsed.description, fallback.description),
      needs: text(parsed.needs, fallback.needs),
      offers: text(parsed.offers, fallback.offers),
      axes,
      status,
    };
  } catch {
    return fallback;
  }
}

/** La ubicación del borrador guardado en el navegador. */
function restoreLocation(raw: string | undefined): LocationDraft {
  if (raw === undefined) return KEEP_LOCATION;
  try {
    return restoreLocationDraft((JSON.parse(raw) as { location?: unknown }).location);
  } catch {
    return KEEP_LOCATION;
  }
}

/** Mensaje de un problema de la ficha; lo comparte la edición rápida (RF-7 (005) · 7.6). */
export function issueText(issue: ContentIssue): string {
  if (issue.code === 'field-required') return REQUIRED[issue.field] ?? messageFor(issue.code);
  if (issue.code === 'text-too-long' && issue.excess !== undefined) {
    return issue.excess === 1 ? 'Sobra 1 carácter.' : `Sobran ${issue.excess} caracteres.`;
  }
  return messageFor(issue.code);
}

/** Mensaje de un guardado fallido: el del servidor si es tipificado; si no, el genérico, que avisa que el texto se conserva. */
export function saveFailureText(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'No pudimos guardar los cambios. Lo que escribiste se conserva: inténtalo de nuevo.';
}

export function ContentForm({ initial, draftKey, submitLabel, onSubmit, showStatus = false, location }: ContentFormProps) {
  const drafts = useDrafts();
  const [values, setValues] = useState<FormValues>(() => restore(drafts.get(draftKey), initial));
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(() => (location ? restoreLocation(drafts.get(draftKey)) : KEEP_LOCATION));
  const [locationError, setLocationError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const update = (changes: Partial<FormValues>): void => {
    const next = { ...values, ...changes };
    setValues(next);
    drafts.set(draftKey, JSON.stringify(location ? { ...next, location: locationDraft } : next));
  };

  const updateLocation = (next: LocationDraft): void => {
    setLocationDraft(next);
    setLocationError(undefined);
    drafts.set(draftKey, JSON.stringify({ ...values, location: next }));
  };

  const validation = validateContent(values);
  const issues = validation.ok ? [] : validation.issues;
  // Lo que falta solo se reclama tras intentar enviar; lo que sobra se avisa mientras se escribe.
  const visible = issues.filter((issue) => submitted || issue.code !== 'field-required');
  const issueFor = (field: ContentField): ContentIssue | undefined => visible.find((issue) => issue.field === field);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    const place = location ? resolveLocationDraft(locationDraft) : null;
    setLocationError(place !== null && !place.ok ? messageFor(place.code) : undefined);
    if (!validation.ok || (place !== null && !place.ok)) return;
    setSending(true);
    setFailure(null);
    try {
      const content = { ...validation.value, status: values.status };
      if (place?.ok) await onSubmit(content, place.value);
      else await onSubmit(content);
    } catch (error) {
      setFailure(saveFailureText(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      {TEXT_FIELDS.map(({ field, label, limit, multiline }) => {
        const issue = issueFor(field);
        const errorId = `${draftKey}-${field}-error`;
        const shared = {
          id: `${draftKey}-${field}`,
          className: 'block',
          value: values[field],
          'aria-invalid': issue !== undefined,
          'aria-describedby': issue === undefined ? undefined : errorId,
        };
        return (
          <div key={field}>
            <label htmlFor={shared.id}>{label}</label>
            {multiline ? (
              <textarea {...shared} onChange={(event) => update({ [field]: event.target.value })} />
            ) : (
              <input type="text" {...shared} onChange={(event) => update({ [field]: event.target.value })} />
            )}
            <span>{`${[...values[field]].length} / ${limit}`}</span>
            {issue !== undefined && <p id={errorId}>{issueText(issue)}</p>}
          </div>
        );
      })}
      <AxisPicker value={values.axes} onChange={(axes) => update({ axes })} describedBy={issueFor('axes') ? `${draftKey}-axes-error` : undefined} />
      {issueFor('axes') !== undefined && <p id={`${draftKey}-axes-error`}>{issueText(issueFor('axes') as ContentIssue)}</p>}
      {showStatus && (
        <div>
          <label htmlFor={`${draftKey}-status`}>Estado</label>
          <select className="block" id={`${draftKey}-status`} value={values.status} onChange={(event) => update({ status: event.target.value as ApiceStatus })}>
            {APICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}
      {location && (
        <LocationPicker
          stored={location.stored}
          exact={location.exact}
          map={location.map}
          mayRaise={location.mayRaise}
          value={locationDraft}
          onChange={updateLocation}
          error={locationError}
        />
      )}
      {failure !== null && <p role="alert" className="block">{failure}</p>}
      <button type="submit" className="block action-primary" disabled={sending}>
        {submitLabel}
      </button>
    </form>
  );
}
