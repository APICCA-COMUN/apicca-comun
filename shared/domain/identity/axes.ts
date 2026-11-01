// Identidad de cada eje: clave sin tilde para los nombres de token, relleno y trazo
// (RF-4 (002) · 4.1 y 4.4, D-4 (002), D-13 (002), D-T3 (002)). El ícono lo da `AXIS_ICONS`.
import { AXES, type Axis } from '../apice';
import type { TokenName } from './tokens';

export type AxisKey = 'agua' | 'alimento' | 'cobijo' | 'energia' | 'comunicacion';

export type AxisIdentity = {
  readonly axis: Axis;
  readonly key: AxisKey;
  readonly fill: TokenName;
  readonly stroke: TokenName;
};

const KEYS: Record<Axis, AxisKey> = {
  agua: 'agua',
  alimento: 'alimento',
  cobijo: 'cobijo',
  energía: 'energia',
  comunicación: 'comunicacion',
};

export const AXIS_IDENTITY: readonly AxisIdentity[] = AXES.map((axis) => {
  const key = KEYS[axis];
  return { axis, key, fill: `axis-${key}-fill`, stroke: `axis-${key}-stroke` } as const;
});

export const axisIdentity = (axis: Axis): AxisIdentity => AXIS_IDENTITY.find((a) => a.axis === axis)!;
