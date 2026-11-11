// RF-7 (003) · 7.6, 7.7, 7.10 (D-27 (003)), RF-15 (021) · 15.3, D-T24 (021): la entrada de la cuenta, igual en la
// cabecera de las páginas de texto y en la barra del mapa. Sin sesión, «Entrar»; con sesión, la inicial, el nombre de
// usuario y el rol, que llevan a «Lo mío» (`/?mio=1`); con la cuenta suspendida, una silueta que lleva al mapa, donde
// está el aviso de suspensión.
import type { Role } from '../../shared/domain/accounts';
import { Link } from '../app/router';
import { useSession } from '../app/session';

/** Nombre del rol tal como lo ve la persona (RF-15 (021) · 15.3). */
export function roleLabel(role: Role): string {
  return role === 'facilitator' ? 'Facilitador' : 'Persona inscrita';
}

/** Silueta genérica de persona para la cuenta suspendida (sin nombre de usuario, RF-11 (003) · 11.9). */
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" focusable="false" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 C4 16.5 7.5 14 12 14 C16.5 14 20 16.5 20 21 Z" />
    </svg>
  );
}

export function SessionEntry() {
  const session = useSession();
  if (session.status === 'person') {
    const role = roleLabel(session.role);
    return (
      <Link href="/?mio=1" className="account-entry" aria-label={`Lo mío, @${session.username}, ${role}`}>
        <span className="account-initial" aria-hidden="true">
          {session.username.charAt(0).toUpperCase()}
        </span>
        <span className="account-entry__text" aria-hidden="true">
          <span className="account-entry__name">@{session.username}</span>
          <span className="account-entry__role">{role}</span>
        </span>
      </Link>
    );
  }
  if (session.status === 'suspended') {
    return (
      <Link href="/" className="block icon-button" aria-label="Cuenta suspendida">
        <PersonGlyph />
      </Link>
    );
  }
  if (session.status === 'visitor') {
    return (
      <Link href="/entrar" className="block action-secondary">
        Entrar
      </Link>
    );
  }
  return null;
}
