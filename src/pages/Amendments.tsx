// RF-6 (004) · 6.1–6.2, RF-7 (004) · 7.1–7.3, RF-9 (004) · 9.4, RF-12 (004) · 12.5, D-T13 (004) · Página
// `/constitucion/propuestas`: propuestas abiertas completas (cierre más próximo primero), cerradas de 20 en 20 y el
// formulario de abrir una propuesta en un diálogo (`#cambiar-ID`, `#quitar-ID`, `#anadir-ID`). Sin cuenta activa, solo el aviso.
import { useEffect, useState } from 'react';
import type { Amendment, AmendmentKind, ConstitutionState, Section } from '../../shared/domain/constitution';
import { todayInColombia } from '../../shared/domain/dates';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { Link, navigate, useRoute } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, type ApiOps, type OpClient } from '../data/api';
import { firestoreAmendmentsSource, type AmendmentsSource, type ClosedCursor } from '../data/constitution/amendments';
import { firestoreSectionsSource, orderSections, type SectionsSource } from '../data/constitution/sections';
import { settleThenRead, type SettleCall } from '../data/constitution/settle';
import { AmendmentForm, type AmendmentFormValues, type AmendmentSubmitResult } from '../components/AmendmentForm';
import { ClosedAmendments } from '../components/ClosedAmendments';
import { DocBlocks } from '../components/DocBlocks';
import { JoinNotice } from '../components/JoinNotice';
import { SuspendedNotice } from '../components/SuspendedNotice';

interface Props {
  amendmentsSource?: AmendmentsSource;
  sectionsSource?: SectionsSource;
  client?: OpClient<ApiOps>;
  settle?: SettleCall;
}

const KIND_LABEL: Record<AmendmentKind, string> = { change: 'Cambiar una sección', add: 'Añadir una sección', remove: 'Quitar una sección' };
const FORM_HASH = /^(cambiar|quitar|anadir)-/;
const HASH_KIND: Record<string, AmendmentKind> = { cambiar: 'change', quitar: 'remove', anadir: 'add' };

/** Tipo y lugar elegidos de antemano por `#cambiar-ID`, `#quitar-ID` o `#anadir-ID` (D-T13 (004)). */
function preselection(hash: string | undefined): { kind?: AmendmentKind; sectionId?: string; after?: string } {
  const match = hash === undefined ? null : /^(cambiar|quitar|anadir)-(.+)$/.exec(hash);
  if (match === null) return {};
  const kind = HASH_KIND[match[1]!]!;
  return kind === 'add' ? { kind, after: match[2]! } : { kind, sectionId: match[2]! };
}

function Formatted({ text }: { text: string }) {
  try {
    return <DocBlocks blocks={parseMarkdown(text)} />;
  } catch {
    return <p>{text}</p>;
  }
}

export function Amendments({
  amendmentsSource = firestoreAmendmentsSource,
  sectionsSource = firestoreSectionsSource,
  client = api,
  settle,
}: Props) {
  usePageTitle({ area: 'Constitución', contentTitle: 'Propuestas' });
  const session = useSession();
  const { hash } = useRoute();
  const active = session.status === 'person';
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<Amendment[]>([]);
  const [closed, setClosed] = useState<Amendment[]>([]);
  const [cursor, setCursor] = useState<ClosedCursor | null>(null);
  const [state, setState] = useState<ConstitutionState | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (hash !== undefined && FORM_HASH.test(hash)) setShowForm(true);
  }, [hash]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const stops: Array<() => void> = [];
    void (async () => {
      // Refleja los vencimientos antes de pintar nada (RF-12 (004) · 12.5).
      const { value } = await settleThenRead({
        active: true,
        ...(settle === undefined ? {} : { settle }),
        read: () => amendmentsSource.fetchClosedPage({}),
      }).catch(() => ({ value: null }));
      if (cancelled) return;
      if (value !== null) {
        setClosed(value.items);
        setCursor(value.cursor);
      }
      const fail = () => setLoadError(true);
      stops.push(
        amendmentsSource.onOpen((list) => setOpen([...list].sort((a, b) => a.closesAt - b.closesAt)), fail),
        sectionsSource.onState(setState, fail),
        sectionsSource.onSections('member', setSections, fail),
      );
      setReady(true);
    })();
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [active, amendmentsSource, sectionsSource, settle]);

  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status === 'suspended') return <SuspendedNotice />;
  if (session.status === 'visitor') {
    return (
      <section className="lot">
        <h1>Propuestas de cambio</h1>
        <JoinNotice />
      </section>
    );
  }
  if (!ready) return <p>Cargando…</p>;

  const current = orderSections(state, sections).filter((s) => !s.isRetired);
  const constitutionOpen = state?.isOpen === true;

  const closeForm = () => {
    setShowForm(false);
    if (hash !== undefined && FORM_HASH.test(hash)) navigate('/constitucion/propuestas', { replace: true });
  };

  const submit = async (values: AmendmentFormValues): Promise<AmendmentSubmitResult> => {
    const result = await client.call('openAmendment', values as ApiOps['openAmendment']['in']);
    if (result.ok) {
      navigate(`/constitucion/propuestas/${result.id}`);
      return { ok: true, id: result.id };
    }
    return result;
  };

  const loadMore = async () => {
    const page = await amendmentsSource.fetchClosedPage({ cursor });
    setClosed((previous) => [...previous, ...page.items]);
    setCursor(page.cursor);
  };

  return (
    <div className="lot amendments">
      <h1>Propuestas de cambio</h1>
      {loadError && (
        <p role="alert" className="block">
          No se pudieron cargar las propuestas. Recarga la página.
        </p>
      )}
      {constitutionOpen ? (
        <button type="button" className="block action-primary" onClick={() => setShowForm(true)}>
          Abrir propuesta
        </button>
      ) : (
        <p className="block">Las propuestas llegan cuando quien facilita abre la constitución.</p>
      )}
      {showForm && constitutionOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="amendment-dialog-title" className="block">
          <h2 id="amendment-dialog-title">Abrir una propuesta</h2>
          <AmendmentForm
            mode="open"
            sections={current.map((s) => ({ id: s.id, title: s.title }))}
            openCount={open.length}
            {...preselection(hash)}
            onSubmit={submit}
            onCancel={closeForm}
          />
        </div>
      )}
      <h2>Abiertas</h2>
      {open.length === 0 ? (
        <div className="block block-empty">
          <p>No hay propuestas abiertas.</p>
        </div>
      ) : (
        <ol className="lot" aria-label="Propuestas abiertas">
          {open.map((a) => (
            <li key={a.id} className="block amendment-item">
              <h2>
                <Link href={`/constitucion/propuestas/${a.id}`}>{a.title}</Link>
              </h2>
              <p className="amendment-meta">
                {KIND_LABEL[a.kind]} · Por {a.authorUsername} · Cierra el {todayInColombia(new Date(a.closesAt))}
                {a.extended ? ' (plazo ampliado)' : ''}
              </p>
              <Formatted text={a.text} />
              <p>Motivo: {a.motive}</p>
            </li>
          ))}
        </ol>
      )}
      <h2>Cerradas</h2>
      <ClosedAmendments amendments={closed} />
      {cursor !== null && (
        <button type="button" className="block action-secondary" onClick={() => void loadMore()}>
          Cargar más propuestas cerradas
        </button>
      )}
    </div>
  );
}
