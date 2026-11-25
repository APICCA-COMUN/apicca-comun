// RF-15 (019) · 15.2 · «E3 · Celda» (24-11-2026, Propuesta del asistente): la celda hexagonal como pieza de interfaz, de punta plana (vértices
// a 0°, 60°…) como las celdas del mapa. `Celda` es el hexágono genérico (relleno, contorno y lo que lleve dentro);
// `HexSuperficie` y `CeldaSuperficie` lo visten con la superficie de patrón de un Ápice, igual que la celda del mapa
// (`ApiceCell`, `src/map/GameMap.tsx`): franjas por eje recortadas al hexágono, regla por Etapa y contorno de 2 px.
import { useId, type ReactNode } from 'react';
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { SuperficieStripes } from './Superficie';
import './Celda.css';

const S3 = Math.sqrt(3);

/** Alto de un hexágono de punta plana de `ancho` px de ancho (de vértice a vértice). */
export const celdaAlto = (ancho: number): number => (ancho * S3) / 2;

const f1 = (value: number): string => value.toFixed(1);

/**
 * Los seis vértices (`points` de un `<polygon>`) del hexágono de `ancho` px, metido media línea de `grosor` hacia dentro para que
 * el contorno, centrado en el borde, no se salga del lienzo.
 */
export function celdaPuntos(ancho: number, grosor = 0): string {
  const h = celdaAlto(ancho);
  const r = ancho / 2 - (grosor / 2) * (2 / S3);
  return Array.from({ length: 6 }, (_, k) => {
    const angle = (Math.PI / 3) * k;
    return `${f1(ancho / 2 + r * Math.cos(angle))},${f1(h / 2 + r * Math.sin(angle))}`;
  }).join(' ');
}

/** Píxeles por unidad del patrón para una celda de `ancho` px: la proporción de la celda del mapa (0,42 con 92 px). */
export const escalaPatron = (ancho: number): number => Number((ancho * 0.00465).toFixed(3));

/** El grosor del contorno de una celda con superficie (`--stroke-outline`). */
export const CONTORNO_SUPERFICIE = 2;

interface CeldaProps {
  /** Ancho de vértice a vértice, en px. */
  ancho: number;
  /** Color de relleno (un `var(--…)`); sin él, la celda queda vacía. */
  relleno?: string;
  /** Color del contorno (un `var(--…)`); sin él no hay contorno. */
  contorno?: string;
  /** Grosor del contorno, en px. */
  grosor?: number;
  /** Lo que va dentro, centrado: un glifo, un número. */
  children?: ReactNode;
  className?: string;
  /** Clase del `<polygon>`, para pintarlo desde una hoja (los colores de eje van así, en clases «superficie»). */
  formaClassName?: string;
}

/** Una celda hexagonal: relleno, contorno y, si hay, su contenido centrado. Es decorativa: el nombre lo da quien la usa. */
export function Celda({ ancho, relleno, contorno, grosor = 0, children, className, formaClassName }: CeldaProps) {
  const alto = celdaAlto(ancho);
  const style: React.CSSProperties = {};
  if (relleno !== undefined) style.fill = relleno;
  if (contorno !== undefined) {
    style.stroke = contorno;
    style.strokeWidth = grosor;
    style.strokeLinejoin = 'miter';
  }
  return (
    <span className={['celda', className].filter(Boolean).join(' ')} style={{ inlineSize: ancho, blockSize: alto }}>
      <svg className="celda__forma" width={ancho} height={alto} viewBox={`0 0 ${f1(ancho)} ${f1(alto)}`} aria-hidden="true" focusable="false">
        <polygon className={['celda__poligono', formaClassName].filter(Boolean).join(' ')} points={celdaPuntos(ancho, contorno === undefined ? 0 : grosor)} style={style} />
      </svg>
      {children !== undefined && <span className="celda__dentro">{children}</span>}
    </span>
  );
}

interface HexSuperficieProps {
  axes: readonly Axis[];
  status: ApiceStatus;
  ancho: number;
  /** Esquina superior izquierda de la celda dentro del SVG que la contiene. */
  x?: number;
  y?: number;
  /** Prefijo único del recorte (varias celdas en un mismo SVG). */
  uid: string;
  grosor?: number;
}

/** La superficie de patrón de un Ápice recortada al hexágono, con su contorno: un `<g>` para llevar dentro de un SVG. */
export function HexSuperficie({ axes, status, ancho, x = 0, y = 0, uid, grosor = CONTORNO_SUPERFICIE }: HexSuperficieProps) {
  const alto = celdaAlto(ancho);
  const clip = `celda-${uid}`;
  return (
    <g transform={x === 0 && y === 0 ? undefined : `translate(${f1(x)} ${f1(y)})`}>
      <defs>
        <clipPath id={clip}>
          <polygon points={celdaPuntos(ancho)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <SuperficieStripes axes={axes} status={status} width={ancho} height={alto} scale={escalaPatron(ancho)} />
      </g>
      <polygon className="celda__contorno" points={celdaPuntos(ancho, grosor)} style={{ strokeWidth: grosor }} />
    </g>
  );
}

interface CeldaSuperficieProps extends Omit<HexSuperficieProps, 'uid' | 'x' | 'y'> {
  /** Con nombre accesible propio; sin él, decorativa. */
  label?: string;
  className?: string;
}

/** Una celda con la superficie de patrón de un Ápice, como SVG propio. */
export function CeldaSuperficie({ axes, status, ancho, grosor, label, className }: CeldaSuperficieProps) {
  const uid = useId().replace(/[^\w-]/g, '');
  const alto = celdaAlto(ancho);
  const a11y = label === undefined ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };
  return (
    <svg
      className={['celda-superficie', className].filter(Boolean).join(' ')}
      width={ancho}
      height={alto}
      viewBox={`0 0 ${f1(ancho)} ${f1(alto)}`}
      focusable="false"
      {...a11y}
    >
      <HexSuperficie axes={axes} status={status} ancho={ancho} uid={uid} {...(grosor === undefined ? {} : { grosor })} />
    </svg>
  );
}
