// RF-13 (003) · 13.1, 13.2, D-T19 (003), RF-3 (020) · Contenido en un lote angosto; «solicita tu inscripción» es un enlace de texto.
// RF-2 (001), RF-6 (002) · 6.3 · /registro sin enlace de invitación: explica que se entra por invitación.
import { isSignedIn, useSession } from '../app/session';
import { Link } from '../app/router';
import { usePageTitle } from '../app/usePageTitle';
import { SignedInNotice } from '../components/SignedInNotice';

export function RegisterInfoPage() {
  usePageTitle({ contentTitle: 'Registro' });
  const session = useSession();
  return (
    <div className="lot lot--access">
      <h1>Registro</h1>
      {isSignedIn(session) ? (
        <SignedInNotice />
      ) : (
        <>
          <p>Aquí se entra por invitación: un facilitador te envía un enlace para crear tu acceso.</p>
          <p>
            Si aún no tienes uno, <Link href="/solicitar">solicita tu inscripción</Link>.
          </p>
        </>
      )}
    </div>
  );
}
