// RF-5 (010), RF-6 (010), RF-20 (021) · 20.5, D-T33 (021), D-T34 (021) · La sección «Caminos» de la vista de lista: una
// fila por Acción Común (título, estado, eje, autoría y participantes), de 24 en 24, las abiertas primero (ya vienen
// ordenadas). Con «Lo mío» y sin caminos, lo dice y ofrece verlos todos.
// «E3 · Celda» (24-11-2026, Propuesta del asistente): sin tarjetas. La sección abre con su línea (`.c-seccion`) y cada Acción
// Común es una fila de datos con filete suave: el nombre como enlace, la línea de ejes, el Arco (`PiezaArco`, 300 × 96, celdas
// de 40) con los Ápices que une cuando se conoce la forma de al menos dos (vía `apiceInfo`; si no, nada) y el rótulo suave con
// estado, autoría y participantes. «Ver más» es un enlace de texto.
import { useState } from 'react';
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { COMMON_ACTION_LIMITS } from '../../shared/domain/commonActions';
import { Link } from '../app/router';
import type { CommonActionSummary } from '../data/commonActions';
import { EjesLinea } from './EjesLinea';
import { PiezaArco, type ApicePieza } from './PiezaArco';
import './CommonActionList.css';

interface Props {
  /** `null` mientras cargan. */
  actions: readonly CommonActionSummary[] | null;
  mine: boolean;
  /** Los ejes, la etapa y el nombre de cada Ápice, para dibujar el Arco de lo que una Acción Común une; sin ellos, no se dibuja. */
  apiceInfo?: ReadonlyMap<string, { axes: readonly Axis[]; status: ApiceStatus; name?: string }>;
}

const STATUS_TEXT = { abierta: 'Abierta', cerrada: 'Cerrada', archivada: 'Archivada' } as const;
const peopleText = (count: number): string => (count === 1 ? '1 participante' : `${count} participantes`);

export function CommonActionList({ actions, mine, apiceInfo }: Props) {
  const [shown, setShown] = useState<number>(COMMON_ACTION_LIMITS.pageSize);
  if (actions === null) return null;
  return (
    <section aria-label="Acciones Comunes" className="common-action-list">
      <div className="c-seccion">
        <h2 className="c-rot">Acciones Comunes</h2>
        {actions.length > 0 && <span className="c-rot c-suave">{actions.length}</span>}
      </div>
      {actions.length === 0 ? (
        mine ? (
          <p className="c-cuerpo">
            Todavía no participas en ninguna Acción Común. <Link href="/acciones" className="c-enlace">Ver todas las Acciones Comunes</Link>
          </p>
        ) : (
          <p className="c-cuerpo">Todavía no hay Acciones Comunes.</p>
        )
      ) : (
        <>
          {actions.slice(0, shown).map((action) => {
            const piezas: ApicePieza[] = action.apiceIds.flatMap((id) => {
              const info = apiceInfo?.get(id);
              return info === undefined ? [] : [{ id, name: info.name ?? 'Ápice', axes: [...info.axes], status: info.status }];
            });
            return (
              <article key={action.id} className="c-dato common-action-list__item">
                <h3 className="common-action-list__nombre">
                  <Link href={`/acciones/${action.id}`}>{action.title}</Link>
                </h3>
                {action.axis !== null && <EjesLinea ejes={[action.axis]} />}
                {piezas.length >= 2 && (
                  <div className="common-action-list__arco">
                    <PiezaArco apices={piezas} ancho={300} alto={96} cel={40} eje={action.axis} cerrada={action.status === 'cerrada'} />
                  </div>
                )}
                <p className="c-rot c-rot--ajuste c-suave">
                  {STATUS_TEXT[action.status]} · Propuesta por @{action.authorUsername} · {peopleText(action.participantCount)}
                </p>
              </article>
            );
          })}
          {actions.length > shown && (
            <button type="button" className="c-enlace action-secondary" onClick={() => setShown((value) => value + COMMON_ACTION_LIMITS.pageSize)}>
              Ver más Acciones Comunes
            </button>
          )}
        </>
      )}
    </section>
  );
}
