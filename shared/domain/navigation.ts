// RF-7 (003) · 7.4, 7.9, RF-11 (003) · 11.8, RF-13 (021) · 13.1 · D-T7 (003), D-T24 (021): la navegación es dato del
// dominio. El menú de juego, el de Facilitación, la sección vigente y el destino de retorno al entrar se prueban sin
// navegador.

export type MenuItem = {
  readonly label: string;
  readonly href: string;
  /** Solo se muestra con sesión de persona inscrita o facilitador. */
  readonly requiresSession: boolean;
};

/** Menú de juego, en orden, con los nombres de D-10 (021) (RF-13 (021) · 13.1). Lo que pide sesión va aparte. */
export const MAIN_MENU: readonly MenuItem[] = [
  { label: 'Jugar', href: '/', requiresSession: false },
  { label: 'Cómo se juega', href: '/documentacion', requiresSession: false },
  { label: 'Reglas', href: '/constitucion', requiresSession: false },
  { label: 'Plaza', href: '/foro', requiresSession: false },
];

/** Menú interno de las páginas de Facilitación (RF-7 (003) · 7.9). */
export const FACILITATION_MENU: readonly MenuItem[] = [
  { label: 'Invitaciones', href: '/facilitacion/invitaciones', requiresSession: true },
  { label: 'Solicitudes', href: '/facilitacion/solicitudes', requiresSession: true },
  { label: 'Cuentas', href: '/facilitacion/cuentas', requiresSession: true },
];

/** `true` si `path` es `href` o cuelga de él, por segmento completo; ignora consulta, fragmento y barra final (RF-7 (003) · 7.4). */
export function isCurrentSection(href: string, path: string): boolean {
  const clean = (path.split(/[?#]/)[0] ?? '').replace(/\/+$/, '');
  return clean === href || clean.startsWith(`${href}/`);
}

/** Destinos de retorno permitidos: lista cerrada, para no abrir redirecciones a rutas arbitrarias (D-T7 (003)). */
const RETURN_TARGETS: readonly string[] = ['/tablero'];

/** Lee `?volver=` y devuelve el destino si está en la lista cerrada; si no, `null` (RF-11 (003) · 11.8). */
export function returnTarget(search: string): string | null {
  const value = new URLSearchParams(search).get('volver');
  return value !== null && RETURN_TARGETS.includes(value) ? value : null;
}
