// RF-21 (001), RF-6 (002), RF-8 (002) · Mapa de ápices: pinta un marcador por ubicación (agrupa los que coinciden),
// con los ejes de sus ápices, omite los ápices sin ubicación y avisa cuando se supera el tope de 300
// (RF-9 (001), RNF-2 (001), RF-6 (002) · 6.1, 6.3, RF-8 (002) · 8.3).
import { useMemo, useState } from 'react';
import type { Axis } from '../../shared/domain/apice';
import { MAP_LIMIT } from '../../shared/domain/discovery';
import { sortAxes } from '../../shared/domain/identity';
import { groupByLocation } from '../../shared/domain/location';
import type { Location } from '../../shared/domain/location';
import type { MapMarker } from '../map/types';
import { MapView } from './MapView';

export interface MappedApice {
  id: string;
  name: string;
  axes: readonly Axis[];
  location: Location | null;
}

export interface ApiceMapProps {
  apices: readonly MappedApice[];
  onSelect?: (id: string) => void;
}

const MAX_NAMES = 3;

function groupLabel(names: readonly string[]): string {
  if (names.length === 1) return names[0] ?? '';
  const shown = names.slice(0, MAX_NAMES).join(', ');
  const rest = names.length > MAX_NAMES ? ` y ${names.length - MAX_NAMES} más` : '';
  return `${names.length} ápices: ${shown}${rest}`;
}

export function ApiceMap({ apices, onSelect }: ApiceMapProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const capped = apices.length > MAP_LIMIT;
  const { groups } = useMemo(() => groupByLocation(apices.slice(0, MAP_LIMIT)), [apices]);
  const markers: MapMarker[] = useMemo(
    () =>
      groups.map((g) => ({
        id: g.key,
        lat: g.lat,
        lng: g.lng,
        label: groupLabel(g.items.map((i) => i.name)),
        axes: sortAxes(g.items.flatMap((i) => i.axes)),
      })),
    [groups],
  );
  const open = groups.find((g) => g.key === openKey);

  const select = (key: string): void => {
    const group = groups.find((g) => g.key === key);
    if (!group) return;
    const [only] = group.items;
    if (group.items.length === 1 && only) {
      setOpenKey(null);
      onSelect?.(only.id);
    } else setOpenKey(key);
  };

  return (
    <div>
      {capped && (
        <p role="status" className="block">
          El mapa muestra {MAP_LIMIT} de {apices.length} ápices. Afina los filtros para ver el resto.
        </p>
      )}
      <MapView markers={markers} onSelect={select} />
      {open && (
        <ul aria-label="Ápices en esta ubicación">
          {open.items.map((item) => (
            <li key={item.id}>
              <button type="button" className="block action-secondary" onClick={() => onSelect?.(item.id)}>
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
