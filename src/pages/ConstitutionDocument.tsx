// RF-5 (004) · 2, 4, 5, 6, 7; RF-17 (004) · 1, 2; RNF-4 (004) · Documento de la constitución en
// `/constitucion/documentos/:id`: lectura para cualquiera, versiones solo para cuentas activas y, para quien facilita,
// edición con `baseVersion`, archivo con confirmación y restauración.
import { useEffect, useMemo, useState } from 'react';
import { validateDocumentText, validateDocumentTitle } from '../../shared/domain/constitution';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { usePageTitle } from '../app/usePageTitle';
import { useSession } from '../app/session';
import { api, ApiClientError, type ApiOps, type DocumentCurrent, type OpClient } from '../data/api';
import { firestoreDocumentsSource, type DocumentDoc, type DocumentsSource, type DocumentVersion } from '../data/constitution/documents';
import { DocBlocks } from '../components/DocBlocks';
import { VersionList } from '../components/VersionList';
import { formatDate } from '../components/ApiceCard';
import './ConstitutionDocument.css';

interface Props {
  id: string;
  source?: DocumentsSource;
  client?: OpClient<ApiOps>;
}

const SAVE_ERROR = 'No se pudo guardar. Inténtalo de nuevo; lo escrito se conservó.';
const ACTION_ERROR = 'No se pudo completar la acción. Inténtalo de nuevo.';

function safeBlocks(markdown: string) {
  try {
    return parseMarkdown(markdown);
  } catch {
    return parseMarkdown('');
  }
}

export function ConstitutionDocument({ id, source = firestoreDocumentsSource, client = api }: Props) {
  const session = useSession();
  const [document, setDocument] = useState<DocumentDoc | null | undefined>(undefined);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [draft, setDraft] = useState<{ title: string; text: string } | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const [conflict, setConflict] = useState<DocumentCurrent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isPerson = session.status === 'person';
  const isFacilitator = session.status === 'person' && session.role === 'facilitator';

  useEffect(() => source.onDocument(id, setDocument), [source, id]);
  useEffect(() => {
    if (!isPerson) return undefined;
    return source.onVersions(id, setVersions);
  }, [source, id, isPerson]);

  // El borrador nace con la primera lectura y no se pisa con lo que llegue después.
  useEffect(() => {
    if (document && draft === null) {
      setDraft({ title: document.title, text: document.text });
      setBaseVersion(document.version);
    }
  }, [document, draft]);

  usePageTitle({ area: 'Constitución', contentTitle: document?.title ?? 'Documento' });
  const blocks = useMemo(() => safeBlocks(document?.text ?? ''), [document?.text]);

  if (session.status === 'loading' || document === undefined) return <p>Cargando…</p>;
  if (document === null) {
    return (
      <section className="lot">
        <h1>Documento</h1>
        <p>No se encontró el documento.</p>
      </section>
    );
  }

  const form = draft ?? { title: document.title, text: document.text };
  const titleCheck = validateDocumentTitle(form.title);
  const textCheck = validateDocumentText(form.text);
  const dirty = form.title !== document.title || form.text !== document.text;

  const run = async (action: () => Promise<void>, fallback = ACTION_ERROR) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setConflict(null);
    const problem = !titleCheck.ok ? titleCheck.reason : !textCheck.ok ? textCheck.reason : undefined;
    if (problem !== undefined) {
      setError(problem);
      return;
    }
    void run(async () => {
      const result = await client.call('saveDocument', { id, baseVersion, title: form.title, text: form.text });
      if (result.ok) setBaseVersion(result.version);
      else {
        setConflict(result.current);
        setBaseVersion(result.current.version);
      }
    }, SAVE_ERROR);
  };

  const archive = () =>
    run(async () => {
      await client.call('archiveDocument', { id });
      setConfirming(false);
    });

  return (
    <article className="lot constitution-document">
      <header>
        <h1>{document.title}</h1>
        <p>Actualizado el {formatDate({ seconds: Math.floor(document.updatedAt / 1000), nanoseconds: 0 })} · versión {document.version}</p>
      </header>
      {document.isArchived && (
        <p role="status" className="block">
          Este documento está archivado.
        </p>
      )}
      <DocBlocks blocks={blocks} />

      {isFacilitator && !document.isArchived && (
        <form className="block constitution-document__form" onSubmit={save} noValidate>
          <label htmlFor="document-title">Título</label>
          <input
            id="document-title"
            className="block"
            value={form.title}
            onChange={(event) => setDraft({ ...form, title: event.target.value })}
          />
          <label htmlFor="document-text">Texto</label>
          <textarea
            id="document-text"
            className="block"
            value={form.text}
            onChange={(event) => setDraft({ ...form, text: event.target.value })}
          />
          {!titleCheck.ok && titleCheck.excess > 0 && <p role="note">{titleCheck.reason}</p>}
          {!textCheck.ok && textCheck.excess > 0 && <p role="note">{textCheck.reason}</p>}
          {dirty && (
            <button type="submit" className="block action-primary" disabled={busy}>
              Guardar cambios
            </button>
          )}
        </form>
      )}

      {conflict !== null && (
        <div role="alert" className="block">
          <p>Alguien editó el documento mientras escribías. Lo vigente es la versión {conflict.version}:</p>
          <p>
            <strong>{conflict.title}</strong>
          </p>
          <p>{conflict.text}</p>
          <p>Lo que escribiste sigue en el formulario; al guardar de nuevo reemplaza lo vigente.</p>
        </div>
      )}
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}

      {isFacilitator && (
        <div className="constitution-document__actions">
          {document.isArchived ? (
            <button type="button" className="block action-secondary" disabled={busy} onClick={() => void run(async () => void (await client.call('restoreDocument', { id })))}>
              Restaurar
            </button>
          ) : confirming ? (
            <>
              <button type="button" className="block action-destructive" disabled={busy} onClick={() => void archive()}>
                Confirmar archivo
              </button>
              <button type="button" className="block action-secondary" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" className="block action-destructive" onClick={() => setConfirming(true)}>
              Archivar
            </button>
          )}
        </div>
      )}

      {isPerson && (
        <section aria-label="Versiones">
          <h2>Versiones</h2>
          <VersionList versions={versions} />
        </section>
      )}
    </article>
  );
}
