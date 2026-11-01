// RF-7 (002) · 7.1 a 7.4, RF-4 (002) · 4.2, D-T10 (002) · Edificio de un ápice: un bloque `charcoal` con los
// íconos de sus ejes en el orden canónico y la imagen pixelada de lado 64·n, con n según el ancho
// disponible (`buildingScale`) y el máximo de cada lugar. Sin imagen, o si no carga, dice «Sin imagen».
import { useLayoutEffect, useRef, useState } from 'react';
import { AXES, type Axis } from '../../shared/domain/apice';
import { BUILDING_CELL, buildingScale } from '../../shared/domain/identity';
import type { ApiceImage } from '../data/apices';
import { AxisIcon } from './AxisIcon';
import { PixelImage } from './PixelImage';
import './Building.css';

interface Props {
  image: ApiceImage | null;
  axes: readonly Axis[];
  /** Factor máximo: 2 en tarjetas y propuestas, 4 en la ficha (D-T10 (002)). */
  max: number;
}

/** El ancho del contenido del edificio, sin su relleno. */
function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

export function Building({ image, axes, max }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => setScale(buildingScale(contentWidth(element), max));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [max]);

  useLayoutEffect(() => setFailed(false), [image]);

  const ordered = AXES.filter((axis) => axes.includes(axis));
  return (
    <div ref={ref} className="block building">
      <span className="building__axes">
        {ordered.map((axis) => (
          <AxisIcon key={axis} axis={axis} labelled />
        ))}
      </span>
      <PixelImage image={failed ? null : image} side={BUILDING_CELL * scale} onError={() => setFailed(true)} />
    </div>
  );
}
