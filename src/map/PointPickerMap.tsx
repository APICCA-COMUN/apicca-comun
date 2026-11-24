// RF-9 (001), RF-8 (002) · Mapa para marcar un punto con un clic. Como el resto de Leaflet, vive en un trozo aparte
// (D-T11 (001)); el teclado marca el punto escribiendo las coordenadas del selector (RNF-2 (001)). El punto es el
// pin propio, sin ejes, y los colores y el tintado los pone `pin.css` (RF-8 (002) · 8.1, 8.3, 8.6, D-T9 (002)).
// RF-10 (019) · 10.3, 10.4, D-T25 (019): la rueda sola desplaza la página (Ctrl o ⌘ acercan y alejan) y el mundo no se repite.
// RF-12 (024) · 12.1 a 12.3, D-T16 (024): sin punto, abre sobre las zonas de los ápices que la persona ve (`pickerView`), una sola
// vez: no si ya hay punto, no si la persona movió el mapa y no cuando las zonas cambian después.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './pin.css';
import { useEffect, useRef } from 'react';
import { pickerView } from '../../shared/domain/pickerView';
import type { PointMapProps } from '../components/LocationPicker';
import { pinIconOptions } from './pinHtml';
import { DEFAULT_CENTER, DEFAULT_ZOOM, mapBaseOptions, minZoomForWidth, TILE_OPTIONS, TILE_URL } from './tiles';
import { bindModifierWheelZoom } from './wheel';

/** Margen del encuadre y zoom máximo al abrir sobre varias zonas (RF-12 (024) · 12.1). */
const FIT_PADDING: [number, number] = [24, 24];
const FIT_MAX_ZOOM = 13;

export default function PointPickerMap({ point, onPick, zones }: PointMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  /** Ya se encuadró (o ya hay un punto): no se vuelve a encuadrar. */
  const framed = useRef(false);
  /** La persona movió el mapa (no cuenta el encuadre propio). */
  const moved = useRef(false);
  const framing = useRef(false);

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { ...mapBaseOptions(host.current.clientWidth), center: point ? [point.lat, point.lng] : [...DEFAULT_CENTER], zoom: point ? 14 : DEFAULT_ZOOM });
    L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(instance);
    const unbindWheel = bindModifierWheelZoom(host.current, instance);
    // Si la ventana cambia de ancho con el mapa abierto, el zoom mínimo la sigue (RF-10 (019) · 10.4).
    const container = host.current;
    instance.on('resize', () => instance.setMinZoom(minZoomForWidth(container.clientWidth)));
    instance.zoomControl.getContainer()?.classList.add('block');
    // El prefijo por defecto de Leaflet lleva una bandera (emoji): se deja el nombre con su enlace. El crédito de
    // OpenStreetMap (obligatorio) viene de `TILE_ATTRIBUTION` y no se toca (QA #4).
    instance.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    instance.on('dragstart zoomstart', () => {
      if (!framing.current) moved.current = true;
    });
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
    // Con un punto el mapa ya abrió sobre él; si luego se quita, tampoco se salta a las zonas.
    if (point !== null) framed.current = true;
    if (framed.current || moved.current || zones === undefined || zones.length === 0) return;
    framed.current = true;
    const view = pickerView(zones);
    framing.current = true;
    try {
      if (view.kind === 'center') instance.setView([view.point.lat, view.point.lng], view.zoom, { animate: false });
      else if (view.kind === 'bounds') {
        instance.fitBounds(
          [
            [view.south, view.west],
            [view.north, view.east],
          ],
          { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate: false },
        );
      }
    } finally {
      framing.current = false;
    }
  }, [zones, point]);

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
