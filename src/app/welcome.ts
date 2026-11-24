// RF-21 (021) · 21.3, 21.4, RNF-6 (021), D-T37 (021): si la invitación ya se vio, en `localStorage` de este navegador. Sin
// almacenamiento, la invitación se muestra en cada carga.

const KEY = 'apicca:bienvenida';

/** `true` si en este navegador ya se eligió «Ver el recorrido» o «Cerrar». */
export function welcomeSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Almacenamiento bloqueado: se cierra solo en esta visita.
  }
}

/** «Ver la bienvenida» del menú (RF-21 (021) · 21.4). */
export function forgetWelcome(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Almacenamiento bloqueado: no había marca que borrar.
  }
}
