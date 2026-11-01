// RF-2 (001) · Aviso para quien abre el registro con una sesión iniciada: debe cerrarla antes de continuar.
// RF-6 (002) · 6.1, 6.3: el aviso es un bloque role="alert" y el botón es acción secundaria.
import { useSignOut } from '../app/session';

export function SignedInNotice() {
  const signOut = useSignOut();
  return (
    <div role="alert" className="block">
      <p>Ya tienes una sesión iniciada. Ciérrala antes de continuar con este registro.</p>
      <button type="button" className="block action-secondary" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </div>
  );
}
