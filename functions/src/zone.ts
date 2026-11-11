// Zona H3 de un punto (RF-5 (021) · 5.1, RF-5 (021) · 5.2, RNF-4 (021), D-T13 (021)). Es el único archivo de producción
// que importa `h3-js`: la biblioteca vive en el servidor y el navegador recibe la celda ya calculada (D-5 (021)).
import { cellToLatLng, latLngToCell } from 'h3-js';
import { DEFAULT_PRECISION, ZONE_RESOLUTION, type Location, type Point, type Precision, type Zone } from '../../shared/domain/location';

/** Seis decimales: unos 11 cm, de sobra para el centro de una celda de kilómetros. */
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** La celda de resolución `ZONE_RESOLUTION` que contiene el punto, con su centro (RF-5 (021) · 5.1). */
export function zoneOf(point: Point): Zone {
  const cell = latLngToCell(point.lat, point.lng, ZONE_RESOLUTION);
  const [lat, lng] = cellToLatLng(cell);
  return { cell, lat: round6(lat), lng: round6(lng) };
}

/**
 * Ubicación que se guarda y se muestra a todas las personas. Aproximada: solo la zona y su centro; el punto no sale
 * (RF-5 (021) · 5.2, RNF-4 (021)). Exacta: el punto y su zona, que el mapa necesita para colocarlo (RF-5 (021) · 5.3).
 */
export function publishedLocation(point: Point, precision: Precision = DEFAULT_PRECISION): Location {
  const zone = zoneOf(point);
  if (precision === 'exact') return { lat: point.lat, lng: point.lng, precision, zone };
  return { lat: zone.lat, lng: zone.lng, precision, zone };
}
