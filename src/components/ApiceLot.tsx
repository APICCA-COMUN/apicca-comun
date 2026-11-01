// RF-6 (005) · 6.1 a 6.11, D-6 (005), D-11 (005), D-T3 (005), D-T4 (005), D-T11 (005) · Lote ilustrado: un edificio por ápice de la lista, en
// una retícula que sale del orden y del ancho (`lotLayout`), con caminos y nodos decorativos entre las filas y las
// columnas. Cada edificio es un botón con el nombre del ápice y `aria-pressed`; las flechas llevan el foco al vecino.
// Con `layout="trail"` y 560 px o más, los edificios siguen un recorrido en zigzag (`lotTrail`); si no, la retícula.
// La lista sigue siendo la alternativa no visual (RNF-1 (005)). Con la lista vacía no se pinta.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AXES } from '../../shared/domain/apice';
import { TRAIL_MIN_WIDTH, lotColumns, lotLayout, lotNeighbor, lotTrail, lotTrailNeighbor } from '../../shared/domain/lotLayout';
import type { ListedApice } from '../data/apices';
import { AxisIcon } from './AxisIcon';
import { Node } from './Node';
import { PixelImage } from './PixelImage';
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
              aria-label={apice.name}
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
              <PixelImage image={apice.image} side={48} />
              <span className="apice-lot__axes">
                {AXES.filter((axis) => apice.axes.includes(axis)).map((axis) => (
                  <AxisIcon key={axis} axis={axis} size={20} />
                ))}
              </span>
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
      <svg
        className="apice-lot__roads"
        viewBox={`0 0 ${layout.columns} ${layout.rows}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {layout.roads.map(({ x1, y1, x2, y2 }) => (
          <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </svg>
      {layout.nodes.map(({ x, y }) => (
        <span
          key={`${x}-${y}`}
          className="apice-lot__node"
          style={{ left: `${(x / layout.columns) * 100}%`, top: `${(y / layout.rows) * 100}%` }}
        >
          <Node />
        </span>
      ))}
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
            aria-label={apice.name}
            aria-pressed={apice.id === selectedId}
            style={{ gridRow: `${cell.row + 1}`, gridColumn: `${cell.column + 1}` }}
            onClick={() => onSelect(apice.id)}
            onKeyDown={move(index)}
          >
            <PixelImage image={apice.image} side={64} />
            <span className="apice-lot__axes">
              {AXES.filter((axis) => apice.axes.includes(axis)).map((axis) => (
                <AxisIcon key={axis} axis={axis} size={20} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
