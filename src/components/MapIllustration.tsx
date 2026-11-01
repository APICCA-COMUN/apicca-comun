// RF-10 (003) · 10.1, RF-9 (003) · 9.3, RF-4 (005) · 4.2, 4.3, D-T9 (005) · Mapa ilustrado del inicio: un lienzo
// cuadrado con seis edificios (dos imágenes pixeladas sobre `charcoal` y cuatro con el relleno y el ícono de un eje),
// unidos por caminos y nodos, y dos hebras al 55 %. Es una imagen con nombre accesible (RF-6 (008) · 6.7) y no lleva texto: los
// ejes se nombran en HTML semántico en el inicio.
import type { CSSProperties } from 'react';
import type { Axis } from '../../shared/domain/apice';
import { axisIdentity } from '../../shared/domain/identity';
import { AxisIcon } from './AxisIcon';
import { Node } from './Node';
import './MapIllustration.css';

/** Imágenes de 8 × 8: `.` cielo, `s` suelo, `w` claro, `a` relleno del eje, `b` trazo del eje. */
const ART = {
  cisterna: ['........', '..bbbb..', '.baaaab.', '.baaaab.', '.baaaab.', '.baaaab.', '.bbbbbb.', 'ssssssss'],
  antena: ['...ww...', '....w...', '...ww...', '....a...', '...aaa..', '...aaa..', '..aaaaa.', 'ssssssss'],
} as const;

type Building = { x: number; y: number; axis: Axis; art?: keyof typeof ART };

// Centros sobre un lienzo de 100 × 100, tomados del diseño.
const BUILDINGS: readonly Building[] = [
  { x: 18, y: 20, axis: 'agua', art: 'cisterna' },
  { x: 52, y: 14, axis: 'alimento' },
  { x: 84, y: 26, axis: 'comunicación', art: 'antena' },
  { x: 18, y: 72, axis: 'cobijo' },
  { x: 52, y: 62, axis: 'agua' },
  { x: 84, y: 80, axis: 'energía' },
];

const ROADS = [
  'M18 20 H35 V14 H52',
  'M52 14 H68 V26 H84',
  'M18 20 V72',
  'M52 14 V62',
  'M18 72 H35 V62 H52',
  'M52 62 H68 V80 H84',
  'M84 26 V80',
];

const STRANDS: readonly { d: string; axis: Axis }[] = [
  { d: 'M18 20 C30 45 40 52 52 62 S74 78 84 80', axis: 'agua' },
  { d: 'M84 26 C70 44 40 60 18 72', axis: 'comunicación' },
];

const NODES = [
  [35, 14],
  [68, 26],
  [52, 38],
  [18, 46],
  [84, 52],
] as const;

const at = (x: number, y: number): CSSProperties => ({ left: `${x}%`, top: `${y}%` });

export function MapIllustration() {
  return (
    <div className="map-illustration" role="img" aria-label="Mapa de ejemplo: seis ápices conectados por caminos y hebras">
      <svg className="map-illustration__lines" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" aria-hidden="true">
        <g className="road-segment map-illustration__roads">
          {ROADS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        {STRANDS.map(({ d, axis }) => (
          <path
            key={d}
            className={`map-illustration__strand map-illustration__strand--${axisIdentity(axis).key}`}
            d={d}
          />
        ))}
      </svg>
      {NODES.map(([x, y]) => (
        <span key={`${x}-${y}`} className="map-illustration__node" style={at(x, y)}>
          <Node />
        </span>
      ))}
      {BUILDINGS.map(({ x, y, axis, art }) => {
        const key = axisIdentity(axis).key;
        return art === undefined ? (
          <span
            key={`${x}-${y}`}
            className={`map-illustration__building map-illustration__building--${key}`}
            data-axis={axis}
            style={at(x, y)}
          >
            <AxisIcon axis={axis} size={32} />
          </span>
        ) : (
          <span
            key={`${x}-${y}`}
            className={`map-illustration__building map-illustration__building--pixel map-illustration__building--${key}`}
            style={at(x, y)}
          >
            <span className="map-illustration__pixels">
              {ART[art].flatMap((row, r) =>
                [...row].map((cell, c) => (
                  <span key={`${r}-${c}`} className="map-illustration__pixel" data-cell={cell === '.' ? 'sky' : cell} />
                )),
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
