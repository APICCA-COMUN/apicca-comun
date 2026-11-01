// RF-10 (004) · 10.1–10.4; RF-11 (004) · 11.1–11.2; RF-8 (004) · 8.1, 8.3; RF-16 (004) · 16.2; RF-17 (004) · 17.1; RNF-4 (004):
// acciones sobre una propuesta abierta según la tabla de la spec 004 §4.3. Presentacional: las páginas conectan los callbacks.
import { useState } from "react";
import { validateReason } from "../../shared/domain/constitution";
import { ApiClientError } from "../data/api";

type Handler = () => void | Promise<unknown>;

export interface StanceBarProps {
  /** La persona que mira abrió la propuesta. */
  isAuthor: boolean;
  /** La persona tiene un acuerdo vigente. */
  hasAgreed: boolean;
  /** La persona tiene una objeción abierta (RF-11 (004) · 11.2). */
  hasOpenObjection?: boolean;
  /** Quien abrió está suspendida: se ocultan «Revisar» y «Retirar» (RF-14 (004) · 14.4). */
  authorSuspended?: boolean;
  onAgree?: Handler;
  onRevoke?: Handler;
  onObject?(reason: string): void | Promise<unknown>;
  onRevise?: Handler;
  onWithdraw?: Handler;
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "No se pudo completar la acción. Inténtalo de nuevo.";
}

export function StanceBar({
  isAuthor,
  hasAgreed,
  hasOpenObjection = false,
  authorSuspended = false,
  onAgree,
  onRevoke,
  onObject,
  onRevise,
  onWithdraw,
}: StanceBarProps) {
  const [objecting, setObjecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (
    action: () => void | Promise<unknown>,
  ): Promise<boolean> => {
    setError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(messageOf(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const validation = validateReason(reason);
  const excess = validation.excess;

  const submitObjection = async () => {
    if (!validation.ok) {
      setError(validation.reason ?? "El motivo no es válido.");
      return;
    }
    const done = await run(() => onObject?.(reason));
    if (done) {
      setObjecting(false);
      setReason("");
    }
  };

  return (
    <div className="lot stance-bar" aria-label="Acciones sobre la propuesta">
      {error !== null && (
        <p role="alert" className="block">
          {error}
        </p>
      )}

      {!isAuthor && (
        <>
          {hasOpenObjection && (
            <p className="block">
              Tienes una objeción abierta: retírala o dala por resuelta antes de
              acordar.
            </p>
          )}
          {!hasAgreed && !hasOpenObjection && (
            <button
              type="button"
              className="block action-primary"
              disabled={busy}
              onClick={() => void run(() => onAgree?.())}
            >
              Acordar
            </button>
          )}
          {hasAgreed && (
            <button
              type="button"
              className="block action-secondary"
              disabled={busy}
              onClick={() => void run(() => onRevoke?.())}
            >
              Revocar acuerdo
            </button>
          )}
          {!objecting && (
            <button
              type="button"
              className="block action-destructive"
              onClick={() => setObjecting(true)}
            >
              Objetar
            </button>
          )}
          {objecting && (
            <div className="block stance-objection">
              <label htmlFor="stance-objection-reason">
                Motivo de la objeción
              </label>
              <textarea
                className="block"
                id="stance-objection-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
              />
              {excess > 0 && <p role="note">{validation.reason}</p>}
              <button
                type="button"
                className="block action-destructive"
                disabled={busy}
                onClick={() => void submitObjection()}
              >
                Enviar objeción
              </button>
              <button
                type="button"
                className="block action-secondary"
                onClick={() => {
                  setObjecting(false);
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </>
      )}

      {isAuthor && !authorSuspended && (
        <>
          <button
            type="button"
            className="block action-secondary"
            onClick={() => void run(() => onRevise?.())}
          >
            Revisar
          </button>
          {!confirmingWithdraw ? (
            <button
              type="button"
              className="block action-destructive"
              onClick={() => setConfirmingWithdraw(true)}
            >
              Retirar
            </button>
          ) : (
            <span className="stance-confirm">
              <button
                type="button"
                className="block action-destructive"
                disabled={busy}
                onClick={() =>
                  void run(() => onWithdraw?.()).then((done) => {
                    if (done) setConfirmingWithdraw(false);
                  })
                }
              >
                Confirmar retiro
              </button>
              <button
                type="button"
                className="block action-secondary"
                onClick={() => setConfirmingWithdraw(false)}
              >
                Cancelar
              </button>
            </span>
          )}
        </>
      )}
    </div>
  );
}
