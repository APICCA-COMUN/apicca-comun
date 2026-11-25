// RF-7 (003) · 7.6, 7.7, 7.10 (D-27 (003)), RF-15 (021) · 15.3, D-T24 (021): la entrada de la cuenta, igual en la
// cabecera de las páginas de texto y en la barra del mapa. Sin sesión, «Entrar»; con sesión, la inicial, el nombre de
// usuario y el rol, que llevan a «Lo mío» (`/?mio=1`); con la cuenta suspendida, una figura que lleva a los Ápices, donde
// está el aviso de suspensión.
// «E3 · Celda» (24-11-2026, Propuesta del asistente): la inicial va dentro de una celda hexagonal de contorno de tinta,
// sin relleno, y «Entrar» es un enlace de texto (`.c-enlace`), sin caja.
import type { Role } from '../../shared/domain/accounts';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { celdaAlto, celdaPuntos } from './Celda';

/** Nombre del rol tal como lo ve la persona (RF-15 (021) · 15.3). */
export function roleLabel(role: Role): string {
  return role === 'facilitator' ? 'Facilitador' : 'Persona inscrita';
}

const ANCHO_CELDA = 44;

/** La celda de la cuenta: hexágono de contorno de tinta con la inicial centrada (decorativa; el nombre lo da el enlace). */
function CeldaCuenta({ inicial }: { inicial: string }) {
  const alto = celdaAlto(ANCHO_CELDA);
  return (
    <span className="account-celda" aria-hidden="true">
      <svg className="account-celda__forma" width={ANCHO_CELDA} height={alto} viewBox={`0 0 ${ANCHO_CELDA} ${alto.toFixed(1)}`} focusable="false">
        <polygon points={celdaPuntos(ANCHO_CELDA, 2)} />
      </svg>
      <span className="account-celda__letra">{inicial}</span>
    </span>
  );
}

/** Figura genérica de persona para la cuenta suspendida (sin nombre de usuario, RF-11 (003) · 11.9): dos cuadrados. */
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" focusable="false" fill="currentColor">
      <rect x="8" y="3" width="8" height="8" />
      <path d="M4 21 V16 H20 V21 Z" />
    </svg>
  );
}

export function SessionEntry() {
  const session = useSession();
  if (session.status === 'person') {
    const role = roleLabel(session.role);
    return (
      <Link href="/?mio=1" className="account-entry" aria-label={`Lo mío, @${session.username}, ${role}`}>
        <CeldaCuenta inicial={session.username.charAt(0).toUpperCase()} />
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
      <Link href="/entrar" className="c-enlace action-secondary">
        Entrar
      </Link>
    );
  }
  return null;
}
