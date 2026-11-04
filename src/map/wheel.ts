// RF-10 (019) · 10.3, D-T25 (019) · Zoom con la rueda solo con Ctrl o ⌘: sin modificador la página se desplaza.
export interface ZoomableMap {
  zoomIn(): unknown;
  zoomOut(): unknown;
}

/** Registra el manejador `wheel` en el contenedor y devuelve la función que lo quita. */
export function bindModifierWheelZoom(container: HTMLElement, map: ZoomableMap): () => void {
  const onWheel = (event: WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    if (event.deltaY < 0) map.zoomIn();
    else if (event.deltaY > 0) map.zoomOut();
  };
  container.addEventListener('wheel', onWheel, { passive: false });
  return () => container.removeEventListener('wheel', onWheel);
}
