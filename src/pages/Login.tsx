// RF-7 (008) · 7.1–7.6, D-10 (008) (en `lots.css`, `SignInForm.css` y `Login.css`), RF-3 (004) · 3.4, D-T19 (004), RF-3 (001), RF-5 (001), RF-6 (002) · 6.3, RF-11 (003) · 11.8, RF-13 (003) · 13.1–13.3, D-T13 (003), D-T19 (003) RF-2 (017) · Página `/entrar`: correo y contraseña con un mensaje único para credenciales incorrectas.
import { useEffect } from 'react';
import { Link, navigate } from '../app/router';
import { usePageTitle } from '../app/usePageTitle';
import { isInternalPath, takeReturnTo } from '../app/returnTo';
import { useSession } from '../app/session';
import { returnTarget } from '../../shared/domain/navigation';
import { SignInForm } from '../components/SignInForm';
import './Login.css';

export function LoginPage() {
  const session = useSession();
  usePageTitle({ contentTitle: 'Entrar' });
  useEffect(() => {
    if (session.status !== 'person') return;
    // D-T19 (004): la ruta de origen guardada gana; si no es interna, Mi tablero. Sin ella, el `?volver=` y, si no hay, Mi tablero.
    const saved = takeReturnTo();
    const target = saved === null ? (returnTarget(window.location.search) ?? '/tablero') : isInternalPath(saved) ? saved : '/tablero';
    navigate(target, { replace: true });
  }, [session.status]);

  // Con cuenta suspendida el aviso de acceso suspendido (SuspendedNotice) ya ocupa el lugar del formulario.
  if (session.status === 'suspended') {
    return (
      <div className="lot lot--access">
        <h1>Entrar</h1>
      </div>
    );
  }
  return (
    <div className="lot lot--access">
      <h1>Entrar</h1>
      <SignInForm autoFocus />
      <div className="login__help">
        <Link href="/olvide">Olvidé mi contraseña</Link>
        {session.status === 'visitor' && (
          <p>
            ¿Aún no tienes invitación? <Link href="/solicitar">Pide tu inscripción</Link>
          </p>
        )}
      </div>
    </div>
  );
}
