// RF-14 (021) · 14.1 · «E3 · Celda» (24-11-2026): la línea de llamada que une una columna con una celda del mapa. Es un
// arco, con la misma geometría que el Arco de las Acciones Comunes (`arcSegment` de `shared/domain/mapArcs.ts`): una curva
// cuadrática con la comba menor (`ARC_BENDS[0]`), siempre hacia arriba, que termina en un disco. Se distingue del Arco de
// una Acción Común por el trazo más fino y por llevar un solo disco, en la llegada. SVG absoluto, sin puntero y decorativo;
// las coordenadas son las del contenedor posicionado que lo contiene.
import { ARC_BENDS, arcSegment, type ArcSegment } from '../../shared/domain/mapArcs';
import './Llamada.css';

export interface LlamadaPunto {
  x: number;
  y: number;
}

const TRAZO = 1.5;
const HALO = 3;
const DISCO = 4;
const MARGEN = DISCO + HALO + 1;

/**
 * El arco de la llamada de `desde` a `hasta`, o `null` si no hay distancia horizontal entre ellos. La comba va siempre
 * hacia arriba (y menor), tanto hacia la derecha como hacia la izquierda.
 */
export function llamadaArco(desde: LlamadaPunto, hasta: LlamadaPunto): ArcSegment | null {
  const lado = Math.sign(hasta.x - desde.x);
  if (lado === 0) return null;
  return arcSegment(desde, hasta, ARC_BENDS[0], lado === 1 ? -1 : 1);
}

interface LlamadaProps {
  desde: LlamadaPunto;
  hasta: LlamadaPunto;
}

export function Llamada({ desde, hasta }: LlamadaProps) {
  const arco = llamadaArco(desde, hasta);
  if (arco === null) return null;
  const xs = arco.samples.map((p) => p.x);
  const ys = arco.samples.map((p) => p.y);
  const left = Math.min(...xs) - MARGEN;
  const top = Math.min(...ys) - MARGEN;
  const width = Math.max(...xs) - Math.min(...xs) + 2 * MARGEN;
  const height = Math.max(...ys) - Math.min(...ys) + 2 * MARGEN;
  return (
    <svg
      className="llamada"
      aria-hidden="true"
      focusable="false"
      width={width}
      height={height}
      viewBox={`${left} ${top} ${width} ${height}`}
      style={{ left, top }}
    >
      <path className="llamada__halo" d={arco.d} style={{ strokeWidth: TRAZO + HALO }} />
      <circle className="llamada__halo-disco" cx={hasta.x} cy={hasta.y} r={DISCO + HALO / 2} />
      <path className="llamada__trazo" d={arco.d} style={{ strokeWidth: TRAZO }} />
      <circle className="llamada__disco" cx={hasta.x} cy={hasta.y} r={DISCO} />
    </svg>
  );
}
