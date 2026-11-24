// RF-5 (010), RF-6 (010), RF-20 (021) · 20.5, D-T33 (021), D-T34 (021) · La sección «Caminos» de la vista de lista: una
// tarjeta por Acción Común (título, estado, eje, autoría y participantes), de 24 en 24, las abiertas primero (ya vienen
// ordenadas). Con «Lo mío» y sin caminos, lo dice y ofrece verlos todos.
import { useState } from 'react';
import { COMMON_ACTION_LIMITS } from '../../shared/domain/commonActions';
import { Link } from '../app/router';
import type { CommonActionSummary } from '../data/commonActions';
import { AxisBadge } from './AxisIcon';
import './CommonActionList.css';

interface Props {
  /** `null` mientras cargan. */
  actions: readonly CommonActionSummary[] | null;
  mine: boolean;
}

const STATUS_TEXT = { abierta: 'Abierta', cerrada: 'Cerrada', archivada: 'Archivada' } as const;
const peopleText = (count: number): string => (count === 1 ? '1 participante' : `${count} participantes`);

export function CommonActionList({ actions, mine }: Props) {
  const [shown, setShown] = useState<number>(COMMON_ACTION_LIMITS.pageSize);
  if (actions === null) return null;
  return (
    <section aria-label="Acciones Comunes" className="common-action-list">
      <h2>Acciones Comunes</h2>
      {actions.length === 0 ? (
        mine ? (
          <p>
            Todavía no participas en ninguna Acción Común. <Link href="/acciones">Ver todas las Acciones Comunes</Link>
          </p>
        ) : (
          <p>Todavía no hay Acciones Comunes.</p>
        )
      ) : (
        <>
          {actions.slice(0, shown).map((action) => (
            <article key={action.id} className="block">
              <h3>
                <Link href={`/acciones/${action.id}`}>{action.title}</Link>
              </h3>
              {action.axis !== null && <AxisBadge axis={action.axis} />}
              <p>
                {STATUS_TEXT[action.status]} · Propuesta por @{action.authorUsername} · {peopleText(action.participantCount)}
              </p>
            </article>
          ))}
          {actions.length > shown && (
            <button type="button" className="block action-secondary" onClick={() => setShown((value) => value + COMMON_ACTION_LIMITS.pageSize)}>
              Ver más Acciones Comunes
            </button>
          )}
        </>
      )}
    </section>
  );
}
