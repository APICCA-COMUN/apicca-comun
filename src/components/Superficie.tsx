// RF-1 (021) · 1.2, RF-4 (002) · 4.5: el Ápice se dibuja con formas planas y colores de tokens, y su eje no se dice solo con color.
// Sistema «APICCA · Mapa» (23-11-2026): la superficie de patrón de un Ápice. El color dice el eje, el glifo repetido
// lo dice otra vez sin depender del color, y la regla con que se repite dice la Etapa (`RULE_BY_STATUS`). Un Ápice
// de varios ejes va en franjas verticales, una por eje, en el orden en que los declaró. Toda superficie lleva un
// contorno de 2 px en `contorno-superficie` (Propuesta del asistente en el sistema; sigue «Por decidir»).
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { APICE_STAGE_LABEL } from '../../shared/domain/apice';
import { axisIdentity, pattern, RULE_BY_STATUS, type PatternRule } from '../../shared/domain/identity';
import './Superficie.css';

/** Los ejes en una enumeración: «agua», «agua y cobijo», «agua, alimento y cobijo». */
export const axesText = (axes: readonly Axis[]): string =>
  axes.length <= 1 ? axes.join('') : `${axes.slice(0, -1).join(', ')} y ${axes[axes.length - 1]}`;
const name = axesText;

interface StripesProps {
  axes: readonly Axis[];
  /** Etapa; con `rule` se fuerza otra regla (leyendas). */
  status?: ApiceStatus;
  rule?: PatternRule;
  width: number;
  height: number;
  /** Píxeles por unidad del patrón (0,5 por defecto, como `superficie` del sistema). */
  scale?: number;
  x?: number;
  y?: number;
}

/** Las franjas de patrón como SVG anidados: sirve dentro de otro SVG (el mapa) y dentro de `Superficie`. */
export function SuperficieStripes({ axes, status = 'idea', rule, width, height, scale = 0.5, x = 0, y = 0 }: StripesProps) {
  const list = axes.length > 0 ? axes : (['agua'] as const);
  const w = width / list.length;
  const r = rule ?? RULE_BY_STATUS[status];
  return (
    <g className="superficie__franjas" data-rule={r}>
      {list.map((axis, i) => {
        const { key } = axisIdentity(axis);
        const p = pattern(key, r, w, height, { scale });
        return (
          <svg
            key={`${axis}-${i}`}
            className={`superficie__franja superficie--${key}`}
            x={x + w * i}
            y={y}
            width={w}
            height={height}
            viewBox={p.viewBox}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
          >
            <rect className="superficie__fondo" x="-4000" y="-4000" width="8000" height="8000" />
            <path className="superficie__glifos" d={p.solid} />
            {p.stroke && <path className="superficie__ecos" d={p.stroke.d} strokeWidth={p.stroke.width} />}
          </svg>
        );
      })}
    </g>
  );
}

interface SuperficieProps extends Omit<StripesProps, 'x' | 'y'> {
  /** Sin contorno solo donde otro borde ya lo cumple (la ficha). */
  outline?: boolean;
  /** Nombre accesible propio; por defecto «agua y cobijo, Etapa Prototipo». Con `decorative`, ninguno. */
  label?: string;
  decorative?: boolean;
  /** Ocupa el ancho de su contenedor; `width` sigue fijando la geometría del patrón. */
  fluid?: boolean;
  className?: string;
}

export function superficieLabel(axes: readonly Axis[], status: ApiceStatus): string {
  return `${name(axes)}, Etapa ${APICE_STAGE_LABEL[status]}`;
}

/** Superficie suelta: ficha, fila de lista, leyenda. Cada franja es su propio SVG con `slice`: el patrón llena el
    espacio sin estirarse aunque la superficie sea fluida. */
export function Superficie({ outline = true, label, decorative = false, fluid = false, className, ...stripes }: SuperficieProps) {
  const { axes, status = 'idea', rule, width, height, scale = 0.5 } = stripes;
  const list = axes.length > 0 ? axes : (['agua'] as const);
  const r = rule ?? RULE_BY_STATUS[status];
  const w = width / list.length;
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': label ?? (rule ? `${name(list)}, ${rule}` : superficieLabel(list, status)) };
  return (
    <span
      className={['superficie', outline && 'superficie--contorno', fluid && 'superficie--fluida', className].filter(Boolean).join(' ')}
      data-rule={r}
      style={fluid ? { blockSize: height } : { inlineSize: width, blockSize: height }}
      {...a11y}
    >
      {list.map((axis, i) => {
        const { key } = axisIdentity(axis);
        const p = pattern(key, r, w, height, { scale });
        return (
          <svg
            key={`${axis}-${i}`}
            className={`superficie__franja superficie--${key}`}
            viewBox={p.viewBox}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
          >
            <rect className="superficie__fondo" x="-4000" y="-4000" width="8000" height="8000" />
            <path className="superficie__glifos" d={p.solid} />
            {p.stroke && <path className="superficie__ecos" d={p.stroke.d} strokeWidth={p.stroke.width} />}
          </svg>
        );
      })}
    </span>
  );
}
