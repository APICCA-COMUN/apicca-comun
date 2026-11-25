// RF-14 (021) · 14.1 · «E3 · Celda» (24-11-2026, Propuesta del asistente): la línea de llamada que une una columna con una celda del mapa. Solo
// horizontales y 60° exactos: sale de `desde` en horizontal y, desde el punto donde empieza a subir o bajar, sigue a 60°
// hasta `hasta`, donde termina en un disco. SVG absoluto, sin puntero y decorativo; las coordenadas son las del contenedor
// posicionado que lo contiene.
import './Llamada.css';

export interface LlamadaPunto {
  x: number;
  y: number;
}

const S3 = Math.sqrt(3);
const TRAZO = 1.5;
const HALO = 3;
const DISCO = 4;
const MARGEN = DISCO + HALO + 1;

/**
 * Los vértices de la línea de llamada, o `null` si no cabe.
 *  - Con espacio (`|hasta.x − desde.x| ≥ |dy| / √3`): `desde`, el punto donde empieza el tramo a 60° (a la altura de
 *    `desde`) y `hasta`; si dy es 0, solo la horizontal.
 *  - Sin espacio horizontal para llegar desde la altura de `desde`: solo el tramo a 60°, desde el punto de esa recta que
 *    está en la x de `desde` (otra altura, pero en el borde de la columna).
 *  - Si `hasta.x` coincide con `desde.x`: nada.
 * Funciona hacia la derecha y hacia la izquierda.
 */
export function llamadaPuntos(desde: LlamadaPunto, hasta: LlamadaPunto): LlamadaPunto[] | null {
  const lado = Math.sign(hasta.x - desde.x);
  if (lado === 0) return null;
  const hueco = Math.abs(hasta.x - desde.x);
  const dy = hasta.y - desde.y;
  const necesita = Math.abs(dy) / S3;
  if (necesita <= hueco) {
    const codo = { x: hasta.x - lado * necesita, y: desde.y };
    return necesita < 0.01 ? [desde, hasta] : necesita > hueco - 0.01 ? [desde, hasta] : [desde, codo, hasta];
  }
  const arriba = Math.sign(desde.y - hasta.y) || 1;
  return [{ x: desde.x, y: hasta.y + arriba * hueco * S3 }, hasta];
}

interface LlamadaProps {
  desde: LlamadaPunto;
  hasta: LlamadaPunto;
}

export function Llamada({ desde, hasta }: LlamadaProps) {
  const puntos = llamadaPuntos(desde, hasta);
  if (puntos === null) return null;
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const left = Math.min(...xs) - MARGEN;
  const top = Math.min(...ys) - MARGEN;
  const width = Math.max(...xs) - Math.min(...xs) + 2 * MARGEN;
  const height = Math.max(...ys) - Math.min(...ys) + 2 * MARGEN;
  const lista = puntos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fin = puntos[puntos.length - 1]!;
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
      <polyline className="llamada__halo" points={lista} style={{ strokeWidth: TRAZO + HALO }} />
      <circle className="llamada__halo-disco" cx={fin.x} cy={fin.y} r={DISCO + HALO / 2} />
      <polyline className="llamada__trazo" points={lista} style={{ strokeWidth: TRAZO }} />
      <circle className="llamada__disco" cx={fin.x} cy={fin.y} r={DISCO} />
    </svg>
  );
}
