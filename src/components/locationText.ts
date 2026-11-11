// RF-9 (001), RF-22 (001), RF-5 (021) · Cómo se dice una ubicación de pantalla: zona o punto, según su precisión.
import type { Location } from '../../shared/domain/location';

/** Número sin ceros de más ni ruido de flotante (los puntos exactos llegan hasta seis decimales). */
export const formatDegrees = (value: number): string => String(Number(value.toFixed(6)));

/** Cómo se dice la zona de una ubicación aproximada: una celda de unos 5 km² (D-6 (021)). */
export const ZONE_SIZE_TEXT = 'zona de ≈ 5 km²';

/** «Sin ubicación» si falta; si no, la zona o el punto exacto (RF-9 (001), RF-5 (021) · 5.2). */
export function describeLocation(location: Location | null | undefined): string {
  if (!location) return 'Sin ubicación';
  const at = `${formatDegrees(location.lat)}, ${formatDegrees(location.lng)}`;
  return location.precision === 'exact' ? `Punto exacto: ${at}` : `Zona de ≈ 5 km² alrededor de ${at}`;
}
