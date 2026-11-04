// RF-21 (001), RF-8 (002) · Mapa Leaflet. Este módulo es el único que importa Leaflet y se carga en un trozo
// aparte (D-T11 (001)); `MapView` lo pide con carga diferida. El pin es un bloque `charcoal` con los íconos de los
// ejes y su nombre accesible los nombra (RF-8 (002) · 8.3, 8.4, D-T9 (002)); `pin.css` tinta las teselas y pone los
// colores del tema (RF-8 (002) · 8.1, 8.2, 8.5, 8.6, D-T8 (002)).
// RF-10 (019) · 10.3, 10.4, D-T25 (019): la rueda sola desplaza la página (Ctrl o ⌘ acercan y alejan) y el mundo no se repite.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../components/AxisIcon.css';
import './pin.css';
import { useEffect, useRef } from 'react';
import { pinAccessibleName } from '../../shared/domain/identity';
import { pinIconOptions } from './pinHtml';
import { DEFAULT_CENTER, DEFAULT_ZOOM, mapBaseOptions, minZoomForWidth, TILE_OPTIONS, TILE_URL } from './tiles';
import { bindModifierWheelZoom } from './wheel';
import type { MapMarker } from './types';

export interface LeafletMapProps {
  markers: readonly MapMarker[];
  /** Se llama con el id del marcador al pulsarlo o con Enter. */
  onSelect?: (id: string) => void;
}

export default function LeafletMap({ markers, onSelect }: LeafletMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { ...mapBaseOptions(host.current.clientWidth), center: [...DEFAULT_CENTER], zoom: DEFAULT_ZOOM });
    L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(instance);
    const unbindWheel = bindModifierWheelZoom(host.current, instance);
    // Si la ventana cambia de ancho con el mapa abierto, el zoom mínimo la sigue (RF-10 (019) · 10.4).
    const container = host.current;
    instance.on('resize', () => instance.setMinZoom(minZoomForWidth(container.clientWidth)));
    // Los controles de zoom son un bloque (RF-6 (002) · 6.1, D-T9 (002)).
    instance.zoomControl.getContainer()?.classList.add('block');
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    return () => {
      unbindWheel();
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    for (const m of markers) {
      const name = pinAccessibleName(m.label, m.axes);
      // Icono de elemento DOM (sin imágenes): enfocable por teclado (RNF-2 (001)).
      const marker = L.marker([m.lat, m.lng], { title: name, keyboard: true, icon: L.divIcon(pinIconOptions(m.axes)) });
      marker.on('click', () => select.current?.(m.id));
      marker.addTo(group);
      const pin = marker.getElement();
      pin?.setAttribute('aria-label', name);
      // Enter o espacio seleccionan; `preventDefault` evita que Leaflet repita el clic con `keypress`.
      pin?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select.current?.(m.id);
      });
    }
    if (markers.length > 0) {
      instance.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), {
        padding: [24, 24],
        maxZoom: 14,
      });
    }
  }, [markers]);

  return <div ref={host} className="apicca-map" />;
}
