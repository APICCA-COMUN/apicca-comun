// RF-6 (004) · 6.1–6.2, 6.5; RF-8 (004) · 8.1; RF-16 (004) · 16.2, 16.4; RF-17 (004) · 17.1–17.2:
// formulario de abrir y de revisar una propuesta de cambio. Presentacional: recibe la función de envío.
import { useState } from "react";
import {
  CONSTITUTION_LIMITS,
  validateProposalText,
  validateReason,
  validateTitle,
  type AmendmentKind,
} from "../../shared/domain/constitution";
import { messageFor } from "../../shared/domain/messages";
import { Link } from "../app/router";
import { ApiClientError, type AmendmentCurrent } from "../data/api";

/** Lo que envía el formulario; coincide con la entrada de `openAmendment` o `reviseAmendment`. */
export type AmendmentFormValues =
  | {
      kind: AmendmentKind;
      sectionId?: string;
      after?: string | null;
      title?: string;
      text?: string;
      motive: string;
    }
  | { title?: string; text?: string; motive: string };

export type AmendmentSubmitResult =
  | { ok: true; id?: string; revisionNo?: number }
  | { ok: false; taken: true; amendmentId: string }
  | { ok: false; conflict: true; current: AmendmentCurrent };

export interface AmendmentFormProps {
  mode: "open" | "revise";
  /** Secciones vigentes, en orden. */
  sections: readonly { id: string; title: string }[];
  /** Al revisar: tipo y sección fijos de la propuesta. Al abrir: los elegidos de antemano (D-T13 (004)). */
  kind?: AmendmentKind;
  sectionId?: string;
  /** Al abrir un «añadir»: la sección tras la que va la nueva (nulo: al principio). */
  after?: string | null;
  /** Valores iniciales (al revisar: la revisión vigente). */
  initial?: { title?: string; text?: string; motive?: string };
  /** Propuestas abiertas hoy, para avisar del máximo de 100 (RF-16 (004) · 16.4). */
  openCount?: number;
  onSubmit(values: AmendmentFormValues): Promise<AmendmentSubmitResult | void>;
  onCancel?(): void;
}

const KIND_LABEL: Record<AmendmentKind, string> = {
  change: "Cambiar una sección",
  add: "Añadir una sección",
  remove: "Quitar una sección",
};

export function AmendmentForm({
  mode,
  sections,
  kind: fixedKind,
  sectionId: fixedSection,
  after: initialAfter,
  initial,
  openCount = 0,
  onSubmit,
  onCancel,
}: AmendmentFormProps) {
  const opening = mode === "open";
  const [kindState, setKindState] = useState<AmendmentKind>(fixedKind ?? "change");
  const kind: AmendmentKind = opening ? kindState : (fixedKind ?? "change");
  const [sectionState, setSectionState] = useState(fixedSection ?? "");
  const sectionId = opening ? sectionState : (fixedSection ?? "");
  const [after, setAfter] = useState(initialAfter ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [motive, setMotive] = useState(initial?.motive ?? "");
  const [error, setError] = useState<string | null>(null);
  const [takenId, setTakenId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<AmendmentCurrent | null>(null);
  const [busy, setBusy] = useState(false);

  const hasContent = kind !== "remove";
  const full = opening && openCount >= CONSTITUTION_LIMITS.openAmendments;
  const titleCheck = validateTitle(title);
  const textCheck = validateProposalText(text);
  const motiveCheck = validateReason(motive);

  const problems = (): string | null => {
    if (opening && kind !== "add" && sectionId === "")
      return "Elige la sección.";
    if (hasContent && !titleCheck.ok) return titleCheck.reason ?? null;
    if (hasContent && !textCheck.ok) return textCheck.reason ?? null;
    if (!motiveCheck.ok) return motiveCheck.reason ?? null;
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setTakenId(null);
    setConflict(null);
    const problem = problems();
    if (problem !== null) {
      setError(problem);
      return;
    }
    const content = hasContent ? { title, text } : {};
    const values: AmendmentFormValues = opening
      ? kind === "add"
        ? { kind, after: after === "" ? null : after, ...content, motive }
        : { kind, sectionId, ...content, motive }
      : { ...content, motive };
    setBusy(true);
    try {
      const result = await onSubmit(values);
      if (result && result.ok === false) {
        if ("taken" in result) setTakenId(result.amendmentId);
        else setConflict(result.current);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "No se pudo guardar. Inténtalo de nuevo; lo escrito se conservó.",
      );
    } finally {
      setBusy(false);
    }
  };

  const excessNote = (check: { excess: number; reason?: string }) =>
    check.excess > 0 ? <p role="note">{check.reason}</p> : null;

  return (
    <form
      className="block amendment-form"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      {full && (
        <p role="status" className="block">
          {messageFor("amendment-limit")}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}
      {takenId !== null && (
        <p role="alert" className="block">
          Ya hay una propuesta abierta en ese lugar.{" "}
          <Link href={`/constitucion/propuestas/${takenId}`}>
            Ver la propuesta abierta
          </Link>
        </p>
      )}
      {conflict !== null && (
        <div role="alert" className="block">
          <p>
            Alguien revisó la propuesta mientras escribías. Lo vigente es la
            revisión {conflict.revisionNo}:
          </p>
          <p>
            <strong>{conflict.title}</strong>
          </p>
          <p>{conflict.text}</p>
          <p>Motivo: {conflict.motive}</p>
        </div>
      )}

      {opening && (
        <>
          <label htmlFor="amendment-kind">Tipo de cambio</label>
          <select
            className="block"
            id="amendment-kind"
            value={kind}
            onChange={(event) =>
              setKindState(event.target.value as AmendmentKind)
            }
          >
            {(Object.keys(KIND_LABEL) as AmendmentKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>

          {kind !== "add" ? (
            <>
              <label htmlFor="amendment-section">Sección</label>
              <select
                className="block"
                id="amendment-section"
                value={sectionState}
                onChange={(event) => setSectionState(event.target.value)}
              >
                <option value="">Elige una sección</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="amendment-after">Lugar</label>
              <select
                className="block"
                id="amendment-after"
                value={after}
                onChange={(event) => setAfter(event.target.value)}
              >
                <option value="">Al principio</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Después de «{s.title}»
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}

      {hasContent && (
        <>
          <label htmlFor="amendment-title">Título</label>
          <input
            className="block"
            id="amendment-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {excessNote(titleCheck)}
          <label htmlFor="amendment-text">Texto</label>
          <textarea
            className="block"
            id="amendment-text"
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {excessNote(textCheck)}
        </>
      )}

      <label htmlFor="amendment-motive">Motivo</label>
      <textarea
        className="block"
        id="amendment-motive"
        rows={4}
        value={motive}
        onChange={(event) => setMotive(event.target.value)}
      />
      {excessNote(motiveCheck)}

      <button
        type="submit"
        className="block action-primary"
        disabled={busy || full}
      >
        {opening ? "Enviar propuesta" : "Guardar revisión"}
      </button>
      <button
        type="button"
        className="block action-secondary"
        onClick={() => onCancel?.()}
      >
        Cancelar
      </button>
    </form>
  );
}
