// Sistema «APICCA · Mapa» («E3 · Celda»): la capa de los Arcos. Una Acción Común se dibuja como una curva suave que une sus
// Ápices (`shared/domain/mapArcs.ts`), con un disco en cada parada. Cada tramo va dos veces: un halo del color del papel
// que lo despega de lo que cruza, y encima el trazo de tinta. Es una capa SVG decorativa, sin puntero: el rótulo del Arco
// (un botón) lo pone `GameMap.tsx`. Los colores y los grosores de línea con guiones salen de GameMap.css.
import { arcHalo, arcStroke, type Arc } from '../../shared/domain/mapArcs';

/** Cuánto más gruesa se dibuja la Acción Común elegida. */
const SELECTED_GROW = 1.6;

/** Un Arco que dibujar y cómo: la Acción Común cerrada, el borrador de «Conectar», la elegida o la apagada. */
export interface ArcItem {
  id: string;
  arc: Arc;
  closed: boolean;
  draft: boolean;
  selected: boolean;
  /** Apagado: no tiene que ver con el filtro o con lo que se eligió (se dibuja en `trama`). */
  off: boolean;
}

interface Props {
  arcs: readonly ArcItem[];
  /** Qué capa dibuja: `off` (los apagados, bajo los Ápices), `live` (los vivos, sobre ellos) o todos juntos si no se dice. */
  layer?: 'off' | 'live';
}

const flag = (value: boolean): 'true' | undefined => (value ? 'true' : undefined);

/** Los apagados primero y la elegida al final: lo apagado nunca tapa lo vivo. */
const rank = (item: ArcItem): number => (item.off ? 0 : item.selected ? 2 : 1);

export function ArcLayer({ arcs, layer }: Props) {
  const ordered = arcs
    .filter((item) => layer === undefined || item.off === (layer === 'off'))
    .sort((a, b) => rank(a) - rank(b));
  return (
    <svg
      className={`game-map__ground game-map__arcs${layer === 'off' ? ' game-map__arcs--off' : ''}`}
      data-layer={layer}
      width="1"
      height="1"
      aria-hidden="true"
      focusable="false"
    >
      {ordered.map(({ id, arc, closed, draft, selected, off }) => {
        const grow = selected ? SELECTED_GROW : 1;
        const stroke = arcStroke(arc.radius) * grow;
        const halo = arcHalo(arc.radius) + (stroke - arcStroke(arc.radius));
        return (
          <g
            key={id}
            className="game-map__arc"
            data-arc={id}
            data-closed={flag(closed)}
            data-draft={flag(draft)}
            data-selected={flag(selected)}
            data-off={flag(off)}
          >
            {arc.segments.map((segment, index) => (
              <path key={`h${index}`} className="game-map__arc-halo" d={segment.d} strokeWidth={halo} />
            ))}
            {arc.discs.map((disc, index) => (
              <circle
                key={`g${index}`}
                className="game-map__arc-disc-halo"
                cx={disc.x}
                cy={disc.y}
                r={disc.r + (halo - stroke) / 2}
              />
            ))}
            {arc.segments.map((segment, index) => (
              <path key={`s${index}`} className="game-map__arc-line" d={segment.d} strokeWidth={stroke} />
            ))}
            {arc.discs.map((disc, index) => (
              <circle key={`d${index}`} className="game-map__arc-disc" cx={disc.x} cy={disc.y} r={disc.r} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
