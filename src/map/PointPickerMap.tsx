// RF-9 (001), RF-8 (002) · Mapa para marcar un punto con un clic. Como el resto de Leaflet, vive en un trozo aparte
// (D-T11 (001)); el teclado marca el punto escribiendo las coordenadas del selector (RNF-2 (001)). El punto es el
// pin propio, sin ejes, y los colores y el tintado los pone `pin.css` (RF-8 (002) · 8.1, 8.3, 8.6, D-T9 (002)).
// RF-10 (019) · 10.3, 10.4, D-T25 (019): la rueda sola desplaza la página (Ctrl o ⌘ acercan y alejan) y el mundo no se repite.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './pin.css';
import { useEffect, useRef } from 'react';
import type { PointMapProps } from '../components/LocationPicker';
import { pinIconOptions } from './pinHtml';
import { DEFAULT_CENTER, DEFAULT_ZOOM, mapBaseOptions, minZoomForWidth, TILE_OPTIONS, TILE_URL } from './tiles';
import { bindModifierWheelZoom } from './wheel';

export default function PointPickerMap({ point, onPick }: PointMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { ...mapBaseOptions(host.current.clientWidth), center: point ? [point.lat, point.lng] : [...DEFAULT_CENTER], zoom: point ? 14 : DEFAULT_ZOOM });
    L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(instance);
    const unbindWheel = bindModifierWheelZoom(host.current, instance);
    // Si la ventana cambia de ancho con el mapa abierto, el zoom mínimo la sigue (RF-10 (019) · 10.4).
    const container = host.current;
    instance.on('resize', () => instance.setMinZoom(minZoomForWidth(container.clientWidth)));
    instance.zoomControl.getContainer()?.classList.add('block');
    instance.on('click', (event: L.LeafletMouseEvent) => pick.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
    map.current = instance;
    return () => {
      unbindWheel();
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
