// RF-15 (019) · 15.2 · «E3 · Celda» (24-11-2026, Propuesta del asistente): la línea de ejes de un Ápice o de una Acción Común (`eje_linea` de la
// referencia). Por cada eje, una celda pequeña de 22 px con el color del eje y contorno de tinta, y el nombre del eje en
// minúscula. El color no es la única señal: el nombre va en texto. Sin glifo dentro de la celda.
import type { Axis } from '../../shared/domain/apice';
import { axisIdentity } from '../../shared/domain/identity';
import { celdaAlto, celdaPuntos } from './Celda';
import './EjesLinea.css';

interface EjesLineaProps {
  ejes: readonly Axis[];
  className?: string;
}

const ANCHO = 22;
const ALTO = celdaAlto(ANCHO);
/** El hexágono metido media línea (1 px) hacia dentro, para que el contorno de 2 px no se salga del lienzo. */
const PUNTOS = celdaPuntos(ANCHO, 2);

export function EjesLinea({ ejes, className }: EjesLineaProps) {
  if (ejes.length === 0) return null;
  return (
    <span className={['ejes-linea', className].filter(Boolean).join(' ')}>
      {ejes.map((axis) => (
        <span key={axis} className="ejes-linea__eje">
          <svg className="ejes-linea__celda" width={ANCHO} height={ALTO} viewBox={`0 0 ${ANCHO} ${ALTO.toFixed(1)}`} aria-hidden="true" focusable="false">
            <polygon className={`ejes-linea__superficie ejes-linea__superficie--${axisIdentity(axis).key}`} points={PUNTOS} />
          </svg>
          <span>{axis}</span>
        </span>
      ))}
    </span>
  );
}

/** Una celda de contorno sin relleno, para un Ápice del que no se conocen los ejes (misma medida que la de la línea de ejes). */
export function CeldaHueca({ ancho = 28 }: { ancho?: number }) {
  return (
    <svg className="ejes-linea__celda" width={ancho} height={celdaAlto(ancho)} viewBox={`0 0 ${ancho} ${celdaAlto(ancho).toFixed(1)}`} aria-hidden="true" focusable="false">
      <polygon className="ejes-linea__hueca" points={celdaPuntos(ancho, 2)} />
    </svg>
  );
}
