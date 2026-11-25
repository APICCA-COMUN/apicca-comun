// Presentación previa al lanzamiento (25-11-2026, decisión de la persona): hasta el lanzamiento oficial, quien llega sin
// sesión a una página del mapa ve la presentación de APICCA en «/»; con cuenta se entra y se ve el mapa como siempre.
// Se enciende sola en las construcciones de producción (`vite build`, modo `production`: el hosting y el canal de
// prueba). La demo, `npm run dev` y las pruebas (modos `development`, `test` y `browser`) la llevan apagada.
// `VITE_PRESENTACION=1` o `=0` la fuerza en cualquier modo (para verla en local con la demo abierta, o para probarla).
// Para el lanzamiento oficial: `HASTA_EL_LANZAMIENTO = false`, construir y publicar el hosting.

/** `true` mientras no se haga el lanzamiento oficial. */
export const HASTA_EL_LANZAMIENTO = true;

/** `true` si esta construcción muestra la presentación a los visitantes. Se lee en cada llamada (las pruebas la cambian). */
export function presentacionActiva(): boolean {
  const forzada = import.meta.env.VITE_PRESENTACION;
  if (forzada === '1') return true;
  if (forzada === '0') return false;
  return HASTA_EL_LANZAMIENTO && import.meta.env.MODE === 'production';
}
