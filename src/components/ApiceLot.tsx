// RF-6 (005) · 6.1, 6.2, 6.4 a 6.9, D-6 (005), D-T3 (005), D-T4 (005) · Lote ilustrado: un edificio por ápice de la lista, en
// una retícula que sale del orden y del ancho (`lotLayout`). Cada edificio es un botón con el nombre del ápice y
// `aria-pressed`; las flechas llevan el foco al vecino. La lista sigue siendo la alternativa no visual (RNF-1 (005)).
// Con la lista vacía no se pinta. RF-8 (019) · 8.1, D-9 (019), D-T5 (019): la retícula va sin caminos ni nodos hasta que
// una spec defina la relación que representan. RF-8 (019) · 8.3, D-9 (019) revisada, D-T26 (019): con `layout="trail"` y
// 560 px o más, los edificios siguen el recorrido en zigzag (`lotTrail`), con sus caminos y nodos (RF-6 (005) · 6.10, 6.11).
// RF-4 (019) · 4.1 a 4.4, RF-5 (019), RF-6 (019) · 6.5, D-T19 (019): cada botón es un `Building` compacto por etapa con el
// nombre debajo, completo (RF-6 (002) · 6.7) y el nombre accesible «nombre, Etapa». RF-9 (019) · 9.1, D-T21 (019): el pin de necesidades.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { APICE_STAGE_LABEL, hasNeeds } from '../../shared/domain/apice';
import { TRAIL_MIN_WIDTH, lotColumns, lotLayout, lotNeighbor, lotTrail, lotTrailNeighbor } from '../../shared/domain/lotLayout';
import type { ListedApice } from '../data/apices';
import { Building } from './Building';
import { Node } from './Node';
import './ApiceLot.css';

interface Props {
  items: readonly ListedApice[];
  selectedId: string | null;
  onSelect(id: string): void;
  layout?: 'grid' | 'trail';
}

export function ApiceLot({ items, selectedId, onSelect, layout: mode = 'grid' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [maxColumns, setMaxColumns] = useState(1);
  const [wide, setWide] = useState(false);
  const empty = items.length === 0;

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const measure = () => {
      setMaxColumns(lotColumns(element.clientWidth));
      setWide(element.clientWidth >= TRAIL_MIN_WIDTH);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [empty]);

  // El contenido de cada edificio es el mismo en la retícula y en el recorrido (RF-5 (019), D-T19 (019)).
  const label = (apice: ListedApice) => `${apice.name}, ${APICE_STAGE_LABEL[apice.status]}`;
  const content = (apice: ListedApice) => (
    <>
      <Building image={apice.image} axes={apice.axes} stage={apice.status} needs={hasNeeds(apice.needs)} max={1} bare />
      <span className="apice-lot__name">{apice.name}</span>
    </>
  );

  function renderTrail() {
    const trail = lotTrail(items.length);
    return (
      <div ref={ref} className="apice-lot apice-lot--trail" style={{ minHeight: `${trail.minHeight}px` }}>
        <svg className="apice-lot__roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {trail.roads.map(({ x1, y1, x2, y2 }) => (
            <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </svg>
        {trail.nodes.map(({ x, y }) => (
          <span key={`${x}-${y}`} className="apice-lot__node" style={{ left: `${x}%`, top: `${y}%` }}>
            <Node />
          </span>
        ))}
        {items.map((apice, index) => {
          const point = trail.points[index]!;
          return (
            <button
              key={apice.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              className="block apice-lot__building apice-lot__building--trail"
              aria-label={label(apice)}
              aria-pressed={apice.id === selectedId}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => onSelect(apice.id)}
              onKeyDown={(event) => {
                const next = lotTrailNeighbor(index, event.key, trail.points);
                if (next === null) return;
                event.preventDefault();
                buttons.current[next]?.focus();
              }}
            >
              {content(apice)}
            </button>
          );
        })}
      </div>
    );
  }

  if (empty) return null;
  if (mode === 'trail' && wide) return renderTrail();
  const layout = lotLayout(items.length, maxColumns);

  const move = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = lotNeighbor(index, event.key, items.length, layout.columns);
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  };

  return (
    <div ref={ref} className="apice-lot" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
      {items.map((apice, index) => {
        const cell = layout.cells[index]!;
        return (
          <button
            key={apice.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            className="block apice-lot__building"
            aria-label={label(apice)}
            aria-pressed={apice.id === selectedId}
            style={{ gridRow: `${cell.row + 1}`, gridColumn: `${cell.column + 1}` }}
            onClick={() => onSelect(apice.id)}
            onKeyDown={move(index)}
          >
            {content(apice)}
          </button>
        );
      })}
    </div>
  );
}
