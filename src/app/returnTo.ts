// RF-3 (004) · 3.4, D-T19 (004): la ruta de origen viaja en `sessionStorage`, solo si es interna, para volver a ella al entrar.
import { useEffect } from 'react';
import { navigate } from './router';
import { useSession } from './session';

const KEY = 'apicca:returnTo';

/** Ruta interna: empieza por «/» y no por «//» ni «/\» (que el navegador toma como otro sitio). */
export function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

/** Guarda la ruta de origen; una ruta no interna se descarta. Sin `sessionStorage` no hace nada. */
export function saveReturnTo(path: string): void {
  if (!isInternalPath(path)) return;
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    // Almacenamiento bloqueado: se entra igual, sin volver al origen.
  }
}

/** Lee y borra la ruta guardada, tal cual (puede no ser interna: quien llama la valida); `null` si no hay. */
export function takeReturnTo(): string | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (value !== null) window.sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}

/** Guardián de los historiales: sin sesión guarda la ruta actual y lleva a `/entrar` (RF-3 (004) · 3.4). */
export function useSignInGuard(): void {
  const session = useSession();
  useEffect(() => {
    if (session.status !== 'visitor') return;
    saveReturnTo(window.location.pathname);
    navigate('/entrar', { replace: true });
  }, [session.status]);
}
