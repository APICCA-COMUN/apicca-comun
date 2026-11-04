// RF-7 (002) · 7.1 a 7.4, RF-4 (002) · 4.2, D-T10 (002) · Edificio de un ápice: un bloque `charcoal` con los
// íconos de sus ejes en el orden canónico y la imagen pixelada de lado 64·n, con n según el ancho
// disponible (`buildingScale`) y el máximo de cada lugar. Sin imagen, o si no carga, dice «Sin imagen».
// RF-4 (019) · 4.1 a 4.4, D-T19 (019), RF-9 (019) · 9.1, 9.3, D-T21 (019), RNF-5 (019): con `stage` crece por etapa
// (base, cuerpo con la imagen, techo), dice la etapa en texto y, con `needs`, lleva el pin sin cifras. Sin `stage`
// es el edificio de siempre (la vista previa de una propuesta de imagen). La etapa es la etiqueta de condición del
// ápice (RF-13 (002) · 13.1): la tarjeta y la ficha no la repiten fuera del edificio.
import { useLayoutEffect, useRef, useState } from 'react';
import { AXES, type Axis } from '../../shared/domain/apice';
import { APICE_STAGE_LABEL, type ApiceStatus } from '../../shared/domain/apice';
import { BUILDING_CELL, axisIdentity, buildingParts, buildingScale } from '../../shared/domain/identity';
import type { ApiceImage } from '../data/apices';
import { AxisIcon } from './AxisIcon';
import { ConditionTag } from './ConditionTag';
import { PixelImage } from './PixelImage';
import './Building.css';

interface Props {
  image: ApiceImage | null;
  axes: readonly Axis[];
  /** Etapa del ápice; sin ella, el edificio es el de la spec 002 (RF-4 (019)). */
  stage?: ApiceStatus;
  /** El ápice tiene necesidades con texto: muestra el pin (RF-9 (019) · 9.1). */
  needs?: boolean;
  /** Factor máximo: 2 en tarjetas y propuestas, 4 en la ficha (D-T10 (002)). */
  max: number;
  /** Dentro de otro bloque (el botón del terreno): sin clase `block`, para no anidar bloques (RF-3 (003) · 3.3). */
  bare?: boolean;
}

/** El marco del cuerpo, `border` de 2 px por lado en `Building.css`: la imagen conserva su lado de 64·n (RF-7 (002) · 7.2). */
const BODY_FRAME = 2;

/** El ancho del contenido del edificio, sin su relleno. */
function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

export function Building({ image, axes, stage, needs = false, max, bare = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [failed, setFailed] = useState(false);

  const staged = stage !== undefined;

  useLayoutEffect(() => {
    const element = ref.current!;
    const frame = staged ? 2 * BODY_FRAME : 0;
    const measure = () => setScale(buildingScale(contentWidth(element) - frame, max));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [max, staged]);

  useLayoutEffect(() => setFailed(false), [image]);

  const ordered = AXES.filter((axis) => axes.includes(axis));
  const icons = (
    <span className="building__axes">
      {ordered.map((axis) => (
        <AxisIcon key={axis} axis={axis} labelled />
      ))}
    </span>
  );
  const picture = <PixelImage image={failed ? null : image} side={BUILDING_CELL * scale} onError={() => setFailed(true)} />;

  if (stage === undefined) {
    return (
      <div ref={ref} className="block building">
        {icons}
        {picture}
      </div>
    );
  }

  const parts = buildingParts(stage);
  const first = ordered[0];
  const className = `${bare ? '' : 'block '}building${first === undefined ? '' : ` building--axis-${axisIdentity(first).key}`}`;
  return (
    <div ref={ref} className={className} data-stage={stage}>
      {icons}
      <div className="building__structure" style={{ width: `${BUILDING_CELL * scale + 2 * BODY_FRAME}px` }}>
        {parts.includes('roof') && <div className="building__roof" />}
        {parts.includes('body') && <div className="building__body">{picture}</div>}
        <div className="building__base" />
      </div>
      <span className="building__stage">
        <ConditionTag condition="status">{APICE_STAGE_LABEL[stage]}</ConditionTag>
      </span>
      {needs && <span className="building__pin" aria-hidden="true" />}
    </div>
  );
}
