// RF-5 (001) · Aviso de acceso suspendido: se muestra solo a quien tiene sesión con cuenta suspendida.
// RF-6 (002) · 6.1, 6.3: el aviso es un bloque role="alert" y el botón es acción secundaria.
import { messageFor } from '../../shared/domain/messages';
import { useSession, useSignOut } from '../app/session';

export function SuspendedNotice() {
  const session = useSession();
  const signOut = useSignOut();
  if (session.status !== 'suspended') return null;
  return (
    <div role="alert" className="block">
      <p>{messageFor('account-suspended')}</p>
      <button type="button" className="block action-secondary" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </div>
  );
}
