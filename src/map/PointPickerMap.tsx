// RF-9 (001), RF-8 (002) · Mapa para marcar un punto con un clic. Como el resto de Leaflet, vive en un trozo aparte
// (D-T11 (001)); el teclado marca el punto escribiendo las coordenadas del selector (RNF-2 (001)). El punto es el
// pin propio, sin ejes, y los colores y el tintado los pone `pin.css` (RF-8 (002) · 8.1, 8.3, 8.6, D-T9 (002)).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './pin.css';
import { useEffect, useRef } from 'react';
import type { PointMapProps } from '../components/LocationPicker';
import { pinIconOptions } from './pinHtml';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from './tiles';

export default function PointPickerMap({ point, onPick }: PointMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { center: point ? [point.lat, point.lng] : [...DEFAULT_CENTER], zoom: point ? 14 : DEFAULT_ZOOM });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(instance);
    instance.zoomControl.getContainer()?.classList.add('block');
    instance.on('click', (event: L.LeafletMouseEvent) => pick.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      pin.current = null;
    };
    // El mapa se crea una vez; los cambios del punto se aplican en el efecto de abajo.
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    pin.current?.remove();
    pin.current = null;
    if (!point) return;
    pin.current = L.marker([point.lat, point.lng], { keyboard: false, icon: L.divIcon(pinIconOptions([])) }).addTo(instance);
  }, [point]);

  return <div ref={host} role="application" aria-label="Mapa para marcar la ubicación" className="apicca-map apicca-map--picker" />;
}
