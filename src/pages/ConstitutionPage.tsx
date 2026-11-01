// RF-11 (008) · 11.1 a 11.6, D-13 (008): entrada del lienzo, camino continuo con un nodo por tarjeta y pie con la fecha real.
// RF-15 (003) · 15.1–15.3, RF-9 (003) · 9.4 · Página `/constitucion`: las secciones como bloques unidos por un camino vertical con nodos.
// RF-1 (004) · 1.2, 1.3; RF-2 (004) · 2.1, 2.2; RF-4 (004) · 4.1–4.3, 4.5, 4.6, 4.10; RF-5 (004) · 5.1, 5.3;
// RF-12 (004) · 12.5; RF-15 (004) · 15.1; RF-17 (004) · 17.1 · Las secciones vigentes salen de Firestore; sin ellas la página lo dice,
// sin texto de respaldo (T-11.4). El facilitador edita antes de la apertura.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  validateDocumentText,
  validateDocumentTitle,
  validateSectionText,
  validateSectionTitle,
  type ConstitutionState,
  type Section,
  type SectionMeta,
} from '../../shared/domain/constitution';
import { todayInColombia } from '../../shared/domain/dates';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { api, ApiClientError, type ApiOps, type OpClient } from '../data/api';
import {
  firestoreDocumentsSource,
  type DocumentCursor,
  type DocumentsSource,
  type ListedDocument,
} from '../data/constitution/documents';
import { firestoreNoticeSource, NO_NOTICE, type NoticeSource } from '../data/constitution/notice';
import { firestoreSectionsSource, orderSections, type SectionsSource } from '../data/constitution/sections';
import { settleThenRead, type SettleCall } from '../data/constitution/settle';
import { AmendmentNotice } from '../components/AmendmentNotice';
import { Node } from '../components/Node';
import { SectionBlock } from '../components/SectionBlock';
import './ConstitutionPage.css';

const FALLBACK_ERROR = 'No se pudo completar la acción. Inténtalo de nuevo.';
const SAVE_ERROR = 'No se pudo guardar. Inténtalo de nuevo; lo escrito se conservó.';

const messageOf = (caught: unknown, fallback: string): string =>
  caught instanceof ApiClientError ? caught.message : fallback;

interface Props {
  sectionsSource?: SectionsSource;
  documentsSource?: DocumentsSource;
  /** Aviso de propuestas abiertas (RF-15 (004) · 15.1). */
  noticeSource?: NoticeSource;
  client?: OpClient<ApiOps>;
  /** Cómo se llama a `settleAmendments` antes de leer (RF-12 (004) · 12.5); en las pruebas es un doble. */
  settle?: SettleCall;
}

export function ConstitutionPage({
  sectionsSource = firestoreSectionsSource,
  documentsSource = firestoreDocumentsSource,
  noticeSource = firestoreNoticeSource,
  client = api,
  settle,
}: Props) {
  const session = useSession();
  const audience = session.status === 'loading' ? null : session.status === 'person' ? 'member' : 'visitor';
  const isMember = session.status === 'person';
  const isFacilitator = session.status === 'person' && session.role === 'facilitator';
  const [notice, setNotice] = useState(NO_NOTICE);

  // RF-15 (004) · 15.1: solo la cuenta activa pide el aviso; si falla, no hay aviso.
  useEffect(() => {
    if (audience !== 'member') return;
    let live = true;
    noticeSource.fetchNotice('member').then(
      (next) => live && setNotice(next),
      () => live && setNotice(NO_NOTICE),
    );
    return () => {
      live = false;
    };
  }, [audience, noticeSource]);

  const [state, setState] = useState<ConstitutionState | null | undefined>(undefined);
  const [sections, setSections] = useState<Section[] | undefined>(undefined);
  const [metas, setMetas] = useState<Record<string, SectionMeta | null>>({});
  const [failed, setFailed] = useState(false);

  // RF-12 (004) · 12.5: la cuenta activa refleja el vencimiento antes de pintar; luego se suscribe.
  useEffect(() => {
    if (audience === null) return undefined;
    let cancelled = false;
    const stops: Array<() => void> = [];
    setState(undefined);
    setSections(undefined);
    setFailed(false);
    void settleThenRead({
      active: audience === 'member',
      ...(settle ? { settle } : {}),
      read: () => undefined,
    }).then(() => {
      if (cancelled) return;
      try {
        const onError = () => setFailed(true);
        stops.push(sectionsSource.onState(setState, onError));
        stops.push(sectionsSource.onSections(audience, setSections, onError));
      } catch {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [audience, sectionsSource, settle]);

  const sectionIds = (sections ?? []).map((s) => s.id).join('|');
  useEffect(() => {
    if (audience !== 'member' || sectionIds === '') return undefined;
    const stops = sectionIds.split('|').map((id) =>
      sectionsSource.onMeta('member', id, (meta) => setMetas((prev) => ({ ...prev, [id]: meta }))),
    );
    return () => stops.forEach((stop) => stop());
  }, [audience, sectionsSource, sectionIds]);

  // Documentos no archivados, de 20 en 20 (RF-5 (004) · 5.1).
  const [documents, setDocuments] = useState<ListedDocument[]>([]);
  const [cursor, setCursor] = useState<DocumentCursor | null>(null);
  const [documentsError, setDocumentsError] = useState(false);
  const loadDocuments = useCallback(
    async (from: DocumentCursor | null) => {
      try {
        const page = await documentsSource.fetchPage({ archived: false, cursor: from });
        setDocuments((prev) => (from === null ? page.items : [...prev, ...page.items]));
        setCursor(page.cursor);
        setDocumentsError(false);
      } catch {
        setDocumentsError(true);
      }
    },
    [documentsSource],
  );
  useEffect(() => {
    void loadDocuments(null);
  }, [loadDocuments]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingOpen, setConfirmingOpen] = useState(false);

  const [creating, setCreating] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');
  const [docError, setDocError] = useState<string | null>(null);

  const loaded = !failed && state !== undefined && sections !== undefined;
  const isOpen = loaded && state?.isOpen === true;
  const ordered = useMemo(
    () => (loaded ? orderSections(state ?? null, sections ?? []).filter((s) => !s.isRetired) : []),
    [loaded, state, sections],
  );
  const canEdit = loaded && !isOpen && isFacilitator;

  const run = async (action: () => Promise<void>, fallback: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(messageOf(caught, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSection = async (event: React.FormEvent) => {
    event.preventDefault();
    const checks = [validateSectionTitle(title), validateSectionText(text)];
    const bad = checks.find((c) => !c.ok);
    if (bad) {
      setError(`${checks[0] === bad ? 'Título' : 'Texto'}: ${bad.reason ?? ''}`);
      return;
    }
    const done = await run(async () => {
      await client.call('saveSection', editingId === null ? { title, text } : { id: editingId, title, text });
    }, SAVE_ERROR);
    if (done) {
      setTitle('');
      setText('');
      setEditingId(null);
    }
  };

  const move = (id: string, delta: -1 | 1) => {
    const ids = ordered.map((s) => s.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    void run(async () => {
      await client.call('reorderSections', { order: ids });
    }, FALLBACK_ERROR);
  };

  const removeSection = async (id: string) => {
    const done = await run(async () => {
      await client.call('removeSection', { id });
    }, FALLBACK_ERROR);
    if (done) setRemoving(null);
  };

  const openConstitution = async () => {
    const done = await run(async () => {
      await client.call('openConstitution', {});
    }, FALLBACK_ERROR);
    if (done) setConfirmingOpen(false);
  };

  const createDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    const titleCheck = validateDocumentTitle(docTitle);
    const textCheck = validateDocumentText(docText);
    if (!titleCheck.ok) return setDocError(`Título: ${titleCheck.reason ?? ''}`);
    if (!textCheck.ok) return setDocError(`Texto: ${textCheck.reason ?? ''}`);
    setBusy(true);
    setDocError(null);
    try {
      await client.call('saveDocument', { title: docTitle, text: docText });
      setCreating(false);
      setDocTitle('');
      setDocText('');
      await loadDocuments(null);
    } catch (caught) {
      setDocError(messageOf(caught, SAVE_ERROR));
    } finally {
      setBusy(false);
    }
  };

  const updatedOn = state ? todayInColombia(new Date(state.updatedAt)) : null;

  return (
    <div className="constitution">
      <header className="constitution__head">
        <h1>Constitución de APICCA COMÚN</h1>
        <p className="constitution__lead">
          Siete principios mandan sobre todo lo demás: sobre cada función, cada spec y cada línea de código.
        </p>
      </header>
      <AmendmentNotice openCount={notice.count} nextClosesAt={notice.nextCloseAt} />
      {!loaded && !failed && <p>Cargando…</p>}

      {loaded && !isOpen && (
        <p className="constitution__notice">Las propuestas de cambio llegan con la apertura de la constitución.</p>
      )}
      {loaded && ordered.length === 0 && (
        <p className="constitution__notice">
          {isOpen ? 'No queda ninguna sección vigente.' : 'La constitución aún no está redactada.'}
        </p>
      )}

      {ordered.length > 0 && (
        <div className="constitution__list">
          {ordered.map((section, i) => (
            <div key={section.id} className="constitution__item">
              <span className="constitution__node">
                <Node />
              </span>
              <SectionBlock section={section} number={i + 1} meta={metas[section.id] ?? null} hasActiveAccount={isMember} />
              {canEdit && (
                <div className="constitution__actions">
                  <button
                    type="button"
                    className="block action-secondary"
                    onClick={() => {
                      setEditingId(section.id);
                      setTitle(section.title);
                      setText(section.text);
                      setError(null);
                    }}
                  >
                    Editar
                  </button>
                  <button type="button" className="block action-secondary" disabled={busy || i === 0} onClick={() => move(section.id, -1)}>
                    Subir
                  </button>
                  <button
                    type="button"
                    className="block action-secondary"
                    disabled={busy || i === ordered.length - 1}
                    onClick={() => move(section.id, 1)}
                  >
                    Bajar
                  </button>
                  <button type="button" className="block action-destructive" onClick={() => setRemoving(section.id)}>
                    Quitar sección
                  </button>
                  {removing === section.id && (
                    <div>
                      <button type="button" className="block action-destructive" disabled={busy} onClick={() => void removeSection(section.id)}>
                        Confirmar quitar
                      </button>
                      <button type="button" className="block action-secondary" onClick={() => setRemoving(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {loaded && ordered.length > 0 && updatedOn !== null && (
        <p className="constitution__updated">Última modificación: {updatedOn}</p>
      )}

      {canEdit && (
        <form className="constitution__form" onSubmit={(e) => void saveSection(e)}>
          <h2>{editingId === null ? 'Nueva sección' : 'Editar sección'}</h2>
          <label>
            Título de la sección
            <input className="block" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Texto de la sección
            <textarea className="block" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button type="submit" className="block action-primary" disabled={busy}>
            Guardar sección
          </button>
          {editingId !== null && (
            <button
              type="button"
              className="block action-secondary"
              onClick={() => {
                setEditingId(null);
                setTitle('');
                setText('');
              }}
            >
              Cancelar edición
            </button>
          )}
          <div className="constitution__open">
            <button type="button" className="block action-destructive" onClick={() => setConfirmingOpen(true)}>
              Abrir la constitución
            </button>
            {confirmingOpen && (
              <div>
                <p>
                  Al abrirla, cada sección conserva su texto actual y desde entonces solo cambia por una propuesta aprobada. No se puede
                  deshacer.
                </p>
                <button type="button" className="block action-destructive" disabled={busy} onClick={() => void openConstitution()}>
                  Confirmar apertura
                </button>
                <button type="button" className="block action-secondary" onClick={() => setConfirmingOpen(false)}>
                  Cancelar apertura
                </button>
              </div>
            )}
          </div>
        </form>
      )}
      {error !== null && <p role="alert" className="constitution__error">{error}</p>}

      {isOpen && isMember && (
        <p>
          <Link href="/constitucion/propuestas" className="block action-primary">
            Abrir propuesta
          </Link>
        </p>
      )}

      {(documents.length > 0 || (isFacilitator && !documentsError)) && (
        <section className="constitution__documents" aria-labelledby="constitution-documents">
          <h2 id="constitution-documents">Documentos</h2>
          {documents.length > 0 && (
            <ul>
              {documents.map((d) => (
                <li key={d.id} className="block constitution__document">
                  <Link href={`/constitucion/documentos/${d.id}`}>{d.title}</Link>
                  <time dateTime={todayInColombia(new Date(d.updatedAt))}>{todayInColombia(new Date(d.updatedAt))}</time>
                  <p>{d.excerpt}</p>
                </li>
              ))}
            </ul>
          )}
          {cursor !== null && (
            <button type="button" className="block action-secondary" onClick={() => void loadDocuments(cursor)}>
              Ver más documentos
            </button>
          )}
          {isFacilitator && (
            <button type="button" className="block action-secondary" onClick={() => setCreating(true)}>
              Nuevo documento
            </button>
          )}
        </section>
      )}
      {documentsError && <p className="constitution__notice">No se pudieron cargar los documentos.</p>}

      {creating && isFacilitator && (
        <div role="dialog" aria-modal="true" aria-labelledby="new-document-title">
          <form onSubmit={(e) => void createDocument(e)}>
            <h2 id="new-document-title">Nuevo documento</h2>
            <label>
              Título del documento
              <input className="block" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            </label>
            <label>
              Texto del documento
              <textarea className="block" rows={8} value={docText} onChange={(e) => setDocText(e.target.value)} />
            </label>
            {docError !== null && <p role="alert">{docError}</p>}
            <button type="submit" className="block action-primary" disabled={busy}>
              Crear documento
            </button>
            <button
              type="button"
              className="block action-secondary"
              onClick={() => {
                setCreating(false);
                setDocError(null);
              }}
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      <p>
        <Link href="/documentacion/constitucion-y-propuestas" className="action-secondary">
          Constitución y propuestas, en la documentación
        </Link>
      </p>
    </div>
  );
}
