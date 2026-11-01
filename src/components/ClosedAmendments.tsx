// RF-7 (004) · 7.2: lista de propuestas cerradas con resultado y motivos (D-T13 (004)).
import { useState } from 'react';
import type { Amendment, AmendmentResult, CloseReason } from '../../shared/domain/constitution/types';
import { todayInColombia } from '../../shared/domain/dates';

export interface ClosedAmendmentsProps {
  amendments: readonly Amendment[];
}

const PAGE_SIZE = 20;

const RESULT_LABELS: Record<AmendmentResult, string> = {
  approved: 'Aprobada',
  rejected: 'No aprobada',
  withdrawn: 'Retirada',
};

const REASON_LABELS: Record<CloseReason, string> = {
  insufficient_agreements: 'Acuerdos insuficientes',
  open_objection: 'Objeción abierta',
};

export function ClosedAmendments({ amendments }: ClosedAmendmentsProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (amendments.length === 0) {
    return (
      <div className="block block-empty">
        <p>No hay propuestas cerradas.</p>
      </div>
    );
  }

  const sorted = [...amendments].sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const displayed = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <section className="lot lot-amendments" aria-label="Propuestas cerradas">
      <ol className="lot">
        {displayed.map((a) => {
          const resultText = a.result ? RESULT_LABELS[a.result] ?? a.result : 'Cerrada';
          const reasonsText = a.reasons.map((r) => REASON_LABELS[r] ?? r).join(', ');

          return (
            <li key={a.id} className="block amendment-item">
              <h3>{a.title}</h3>
              <p className="amendment-meta">
                {a.closedAt !== null && (
                  <time dateTime={todayInColombia(new Date(a.closedAt))}>{todayInColombia(new Date(a.closedAt))}</time>
                )}
                {a.authorUsername && ` · Por ${a.authorUsername}`}
              </p>
              <p className="amendment-result">Resultado: {resultText}</p>
              {a.reasons.length > 0 && <p className="amendment-reasons">Motivos: {reasonsText}</p>}
            </li>
          );
        })}
      </ol>
      {hasMore && (
        <button type="button" className="block action-secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
          Ver más
        </button>
      )}
    </section>
  );
}
