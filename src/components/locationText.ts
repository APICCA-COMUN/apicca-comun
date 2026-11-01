// RF-9 (001), RF-22 (001) · Cómo se dice una ubicación de pantalla: zona o punto, según su precisión.
import type { Location } from '../../shared/domain/location';

/** Número sin ceros de más ni ruido de flotante (los puntos exactos llegan hasta seis decimales). */
export const formatDegrees = (value: number): string => String(Number(value.toFixed(6)));

/** «Sin ubicación» si falta; si no, la zona de ≈ 1 km o el punto exacto (RF-9 (001)). */
export function describeLocation(location: Location | null | undefined): string {
  if (!location) return 'Sin ubicación';
  const at = `${formatDegrees(location.lat)}, ${formatDegrees(location.lng)}`;
  return location.precision === 'exact' ? `Punto exacto: ${at}` : `Zona de ≈ 1 km alrededor de ${at}`;
}
