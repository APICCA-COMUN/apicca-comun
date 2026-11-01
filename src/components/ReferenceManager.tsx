// RF-15 (001), RF-16 (001), RNF-2 (001), RF-6 (002), RF-2 (002), RF-13 (002) · 13.1, 13.3; RF-4 (003) · 4.8; RF-5 (007) · Referencias de un ápice: lista de las no quitadas, subida con validación local,
// quitar (cualquier persona inscrita, ápice no archivado) y retiro con motivo y vista de las quitadas (facilitación).
// Retirar y confirmar el retiro (piden motivo) son destructivas; quitar, cancelar y subir son secundarias (RF-4 (003) · 4.8).
import { useEffect, useState, type FormEvent } from 'react';
import { validateReferenceMeta, REFERENCE_CONTENT_TYPES } from '../../shared/domain/images';
import { isBlank } from '../../shared/domain/limits';
import { messageFor, type ErrorCode } from '../../shared/domain/messages';
import { api, ApiClientError, media, type ApiOps, type MediaOps, type OpClient } from '../data/api';
import {
  firestoreReferenceSource,
  storageReferenceUploader,
  type ReferenceRow,
  type ReferenceSource,
  type ReferenceUploader,
} from '../data/references';
import { ConditionTag } from './ConditionTag';
import './ReferenceManager.css';

interface Props {
  apiceId: string;
  /** Persona inscrita activa y ápice no archivado: puede subir y quitar. */
  canEdit: boolean;
  /** La facilitación retira en cualquier ápice y ve las quitadas. */
  isFacilitator: boolean;
  source?: ReferenceSource;
  uploader?: ReferenceUploader;
  mediaClient?: OpClient<MediaOps>;
  client?: OpClient<ApiOps>;
}

const FALLBACK = 'No se pudo completar la acción. Inténtalo de nuevo.';
const errorText = (caught: unknown): string => (caught instanceof ApiClientError ? caught.message : FALLBACK);
const codeText = (code: ErrorCode): string => messageFor(code);

/** La imagen la entrega la op del servidor y se pinta desde un `blob:`; si no llega, se avisa (D-T3 (007)). */
function ReferenceImage({ apiceId, row, source }: { apiceId: string; row: ReferenceRow; source: ReferenceSource }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    source.readImage(apiceId, row.id).then(
      (next) => alive && setUrl(next),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [source, apiceId, row.id]);
  if (failed) return <span role="status" className="block">No se pudo cargar la imagen.</span>;
  if (url === null) return <span role="status" className="block">Cargando imagen…</span>;
  return <img src={url} alt={row.altText} className="reference-image" />;
}

export function ReferenceManager({
  apiceId,
  canEdit,
  isFacilitator,
  source = firestoreReferenceSource,
  uploader = storageReferenceUploader,
  mediaClient = media,
  client = api,
}: Props) {
  const [rows, setRows] = useState<ReferenceRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retracting, setRetracting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => source.onReferences(apiceId, { includeRemoved: isFacilitator }, setRows), [source, apiceId, isFacilitator]);

  const active = rows.filter((r) => !r.isRemoved);
  const hidden = isFacilitator ? rows.filter((r) => r.isRemoved) : [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setUploadError(null);
    if (file === null) {
      setUploadError(codeText('image-missing'));
      return;
    }
    const checked = validateReferenceMeta({
      contentType: file.type,
      bytes: file.size,
      altText,
      currentCount: active.length,
    });
    if (!checked.ok) {
      setUploadError(codeText(checked.code));
      return;
    }
    setProgress(0);
    try {
      const uploadId = await uploader.upload(file, (fraction) => setProgress(Math.round(fraction * 100)));
      await mediaClient.call('addReference', { id: apiceId, uploadId, altText: checked.value.altText });
      setFile(null);
      setAltText('');
    } catch (caught) {
      setUploadError(errorText(caught));
    } finally {
      setProgress(null);
    }
  };

  const remove = async (refId: string) => {
    setActionError(null);
    try {
      await client.call('removeReference', { id: apiceId, refId });
    } catch (caught) {
      setActionError(errorText(caught));
    }
  };

  const retract = async (refId: string) => {
    if (isBlank(reason)) {
      setReasonError(codeText('retract-reason-required'));
      return;
    }
    setReasonError(null);
    try {
      await client.call('retractImage', { id: apiceId, refId, reason: reason.trim() });
      setRetracting(null);
      setReason('');
    } catch (caught) {
      setReasonError(errorText(caught));
    }
  };

  return (
    <section aria-label="Referencias">
      <h3>Referencias</h3>
      {active.length === 0 ? <p>Aún no hay referencias.</p> : null}
      <ul>
        {active.map((row) => (
          <li key={row.id}>
            <ReferenceImage apiceId={apiceId} row={row} source={source} />
            <p>Subida por {row.uploadedByUsername}</p>
            {canEdit ? (
              <button type="button" className="block action-secondary" aria-label={`Quitar referencia: ${row.altText}`} onClick={() => void remove(row.id)}>
                Quitar
              </button>
            ) : null}
            {isFacilitator ? (
              <button
                type="button"
                className="block action-destructive"
                aria-label={`Retirar referencia: ${row.altText}`}
                onClick={() => {
                  setRetracting(row.id);
                  setReason('');
                  setReasonError(null);
                }}
              >
                Retirar
              </button>
            ) : null}
            {retracting === row.id ? (
              <div>
                <label>
                  Motivo del retiro
                  <input className="block" value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                <button type="button" className="block action-destructive" onClick={() => void retract(row.id)}>
                  Confirmar retiro
                </button>
                <button type="button" className="block action-secondary" onClick={() => setRetracting(null)}>
                  Cancelar
                </button>
                {reasonError === null ? null : <p role="alert" className="block">{reasonError}</p>}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {actionError === null ? null : <p role="alert" className="block">{actionError}</p>}

      {canEdit ? (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <label>
            Imagen de referencia
            <input
              type="file"
              className="block"
              accept={REFERENCE_CONTENT_TYPES.join(',')}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Texto alternativo
            <input className="block" value={altText} onChange={(e) => setAltText(e.target.value)} />
          </label>
          <button type="submit" className="block action-secondary" disabled={progress !== null}>
            Subir referencia
          </button>
          {progress === null ? null : <progress max={100} value={progress} aria-label="Progreso de la subida" />}
          {uploadError === null ? null : <p role="alert" className="block">{uploadError}</p>}
        </form>
      ) : null}

      {isFacilitator ? (
        <section aria-label="Referencias quitadas o retiradas">
          <h4>Referencias quitadas o retiradas</h4>
          {hidden.length === 0 ? <p>No hay referencias quitadas.</p> : null}
          <ul>
            {hidden.map((row) => (
              <li key={row.id}>
                {row.altText} · <ConditionTag condition="reference">{row.removal?.kind === 'retracted' ? 'Retirada' : 'Quitada'}</ConditionTag> por{' '}
                {row.removal?.byUsername ?? 'una persona'}
                {row.removal?.reason === undefined ? '' : ` · Motivo: ${row.removal.reason}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
