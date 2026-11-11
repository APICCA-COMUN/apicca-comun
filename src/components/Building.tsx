// RF-1 (021) · 1.1, 1.2, RF-2 (021) · 2.1 a 2.6, RF-3 (021) · 3.1 a 3.5, D-T3 (021), D-T4 (021) · Edificio de un ápice,
// dibujado con formas planas en un SVG a partir de sus ejes, su etapa y su identificador (`buildingShape`): la base, el
// cuerpo y el techo llevan el color del primer eje, y cada eje tiene su motivo con el nombre del eje como texto.
// RF-7 (002) · 7.2, D-T10 (002): el lado es 64·n, con n según el ancho disponible (`buildingScale`) y el máximo de cada lugar.
// RF-4 (019) · 4.4, RF-13 (002) · 13.1: la etapa es la etiqueta de condición del ápice; la tarjeta y la ficha no la repiten.
// RF-9 (019) · 9.1, 9.3, D-T21 (019): con `needs`, lleva el pin sin cifras. RNF-5 (019): el movimiento respeta la preferencia.
import { useLayoutEffect, useRef, useState } from 'react';
import { APICE_STAGE_LABEL, type ApiceStatus, type Axis } from '../../shared/domain/apice';
import { BUILDING_CELL, axisIdentity, buildingScale, buildingShape, type BuildingShape } from '../../shared/domain/identity';
import { AxisIcon } from './AxisIcon';
import { ConditionTag } from './ConditionTag';
import './Building.css';

interface Props {
  axes: readonly Axis[];
  stage: ApiceStatus;
  /** Identificador del ápice: de él sale la variante de forma (RF-2 (021) · 2.5). */
  seed?: string;
  /** El ápice tiene necesidades con texto: muestra el pin (RF-9 (019) · 9.1). */
  needs?: boolean;
  /** Factor máximo: 1 en el terreno, 2 en tarjetas, 4 en la ficha (D-T10 (002)). */
  max: number;
}

/** Margen del ícono dentro del puesto de su motivo, en unidades de la celda. */
const MOTIF_INSET = 1;

interface DrawingProps {
  shape: BuildingShape;
  /** Lado en píxeles; sin él, el tamaño lo pone la hoja de estilos de quien lo usa. */
  side?: number;
  /** Cada motivo lleva el nombre de su eje (RF-2 (021) · 2.6); sin esto, el dibujo entero es decorativo. */
  labelled?: boolean;
}

/** El dibujo solo, sin pin ni etiqueta: lo usan el edificio y el mapa de ejemplo del inicio (D-T5 (021)). */
export function BuildingDrawing({ shape, side, labelled = false }: DrawingProps) {
  return (
    <svg
      className="building__drawing"
      viewBox={`0 0 ${BUILDING_CELL} ${BUILDING_CELL}`}
      width={side}
      height={side}
      focusable="false"
      aria-hidden={labelled ? undefined : true}
    >
      <rect className="building__base" {...shape.base} rx="2" />
      {shape.body !== null && (
        <g className="building__body">
          <rect className="building__wall" {...shape.body} />
          {shape.windows.map((box) => (
            <rect key={`${box.x}-${box.y}`} className="building__window" {...box} rx="1" />
          ))}
          {shape.door !== null && <rect className="building__door" {...shape.door} />}
        </g>
      )}
      {shape.roof !== null && <polygon className="building__roof" points={shape.roof.points.map((point) => point.join(',')).join(' ')} />}
      {shape.motifs.map(({ axis, x, y, size }) => (
        <g key={axis} className="building__motif">
          <rect className="building__plate" x={x} y={y} width={size} height={size} rx="2" />
          <AxisIcon axis={axis} labelled={labelled} x={x + MOTIF_INSET} y={y + MOTIF_INSET} size={size - 2 * MOTIF_INSET} />
        </g>
      ))}
    </svg>
  );
}

export function Building({ axes, stage, seed, needs = false, max }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => setScale(buildingScale(element.clientWidth, max));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [max]);

  const shape = buildingShape({ axes, stage, seed });
  const first = shape.motifs[0]?.axis;
  return (
    <div
      ref={ref}
      className={`building${first === undefined ? '' : ` building--axis-${axisIdentity(first).key}`}`}
      data-stage={stage}
      data-variant={shape.variant}
    >
      <span className="building__figure">
        <BuildingDrawing shape={shape} side={BUILDING_CELL * scale} labelled />
        {needs && <span className="building__pin" aria-hidden="true" />}
      </span>
      <span className="building__stage">
        <ConditionTag condition="status">{APICE_STAGE_LABEL[stage]}</ConditionTag>
      </span>
    </div>
  );
}
