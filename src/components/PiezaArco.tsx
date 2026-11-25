// RF-18 (021) · 18.5 · «E3 · Celda» (24-11-2026, Propuesta del asistente): la Acción Común fuera del mapa. Las celdas pequeñas de los Ápices que
// une, en fila, cada una con su superficie de patrón, y entre cada par un arco con halo de papel y un disco en cada extremo
// (la pieza `piezaArco` de la referencia, con la geometría de `shared/domain/mapArcs.ts`). Si no caben todos los Ápices,
// se dibujan los que quepan y una celda de tinta «+N», como en el mapa. Con `eje`, el eje (glifo sobre su losa de color) va sobre el arco del medio; con `cerrada`, el trazo es discontinuo.
import { useId } from 'react';
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { arcDiscR, arcHalo, arcSegment, arcStroke } from '../../shared/domain/mapArcs';
import { celdaAlto, celdaPuntos, HexSuperficie } from './Celda';
import { AxisIcon } from './AxisIcon';
import './PiezaArco.css';

export interface ApicePieza {
  id: string;
  name: string;
  axes: Axis[];
  status: ApiceStatus;
}

interface PiezaArcoProps {
  apices: readonly ApicePieza[];
  /** Ancho y alto del lienzo, en px (329 × 120 con celdas de 44; 300 × 96 con 40). */
  ancho: number;
  alto: number;
  /** Ancho de cada celda, en px. */
  cel: number;
  /** El eje de la Acción Común: su glifo va sobre el arco del medio. */
  eje?: Axis | null;
  /** Acción Común cerrada: el trazo va discontinuo, como su Arco en el mapa. */
  cerrada?: boolean;
}

/** La comba del arco de la referencia, como fracción de la distancia entre sus extremos, hacia arriba. */
const COMBA = 0.32;
/** Distancia mínima entre centros de celdas contiguas, en anchos de celda: deja sitio al arco entre ellas. */
const PASO_MIN = 1.8;
/** El eje sobre el arco del medio va en su losa de color (`AxisIcon`), no suelto: un círculo macizo se confundiría con los discos. */
const GLIFO = 20;

/** Cuántas celdas caben en `ancho` px (la «+N» cuenta como una). */
export function celdasQueCaben(ancho: number, cel: number): number {
  return Math.max(1, Math.floor((ancho - cel - 4) / (cel * PASO_MIN)) + 1);
}

export function PiezaArco({ apices, ancho, alto, cel, eje = null, cerrada = false }: PiezaArcoProps) {
  const uid = useId().replace(/[^\w-]/g, '');
  const total = apices.length;
  const caben = celdasQueCaben(ancho, cel);
  const sobran = total > caben;
  const visibles = sobran ? caben - 1 : total;
  const resto = total - visibles;
  const celdas = visibles + (sobran ? 1 : 0);
  const ch = celdaAlto(cel);
  const cy = alto - ch / 2 - 2;
  const xs = Array.from({ length: celdas }, (_, i) => cel / 2 + 2 + ((ancho - cel - 4) * i) / Math.max(1, celdas - 1));
  const radio = cel;
  const trazo = arcStroke(radio);
  const halo = arcHalo(radio);
  const disco = arcDiscR(radio);
  const ay = cy - ch * 0.42;
  const tramos = [];
  for (let i = 1; i < celdas; i += 1) {
    const a = { x: xs[i - 1]! + cel * 0.32, y: ay };
    const b = { x: xs[i]! - cel * 0.32, y: ay };
    const seg = arcSegment(a, b, COMBA, -1);
    if (seg !== null) tramos.push({ a, b, d: seg.d, samples: seg.samples });
  }
  const medio = tramos[Math.floor((tramos.length - 1) / 2)];
  const cima = medio === undefined ? null : medio.samples[Math.floor(medio.samples.length / 2)]!;
  const nombres = apices.map((a) => a.name).join(', ');
  return (
    <svg
      className={cerrada ? 'pieza-arco pieza-arco--cerrada' : 'pieza-arco'}
      data-cerrada={cerrada ? 'true' : undefined}
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={`Ápices que une: ${nombres}`}
      focusable="false"
    >
      {tramos.map((t, i) => (
        <g key={i}>
          <path className="pieza-arco__halo" d={t.d} style={{ strokeWidth: halo }} />
          <path className="pieza-arco__trazo" d={t.d} style={{ strokeWidth: trazo }} />
        </g>
      ))}
      {apices.slice(0, visibles).map((apice, i) => (
        <HexSuperficie key={apice.id} axes={apice.axes} status={apice.status} ancho={cel} x={xs[i]! - cel / 2} y={cy - ch / 2} uid={`${uid}-${i}`} />
      ))}
      {sobran && (
        <g transform={`translate(${(xs[celdas - 1]! - cel / 2).toFixed(1)} ${(cy - ch / 2).toFixed(1)})`}>
          <polygon className="pieza-arco__mas" points={celdaPuntos(cel, 2)} />
          <text className="pieza-arco__mas-texto" x={cel / 2} y={ch / 2} textAnchor="middle" dominantBaseline="central">{`+${resto}`}</text>
        </g>
      )}
      {tramos.map((t, i) => (
        <g key={`d${i}`}>
          <circle className="pieza-arco__disco" cx={t.a.x} cy={t.a.y} r={disco} />
          <circle className="pieza-arco__disco" cx={t.b.x} cy={t.b.y} r={disco} />
        </g>
      ))}
      {eje !== null && cima !== null && (
        <g className="pieza-arco__glifo">
          <AxisIcon axis={eje} size={GLIFO} x={cima.x - GLIFO / 2} y={cima.y - GLIFO - 4} />
        </g>
      )}
    </svg>
  );
}
