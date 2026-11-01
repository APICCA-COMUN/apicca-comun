// RF-9 (004) · 9.4: aviso de deliberación para personas sin cuenta activa.
import { Link } from '../app/router';

export function JoinNotice() {
  return (
    <aside className="block join-notice" role="status" aria-label="Aviso de deliberación">
      <p>La deliberación es de las personas inscritas.</p>
      <p>
        Para participar, <Link href="/entrar">inicia sesión</Link> con tu cuenta o consulta la{' '}
        <Link href="/registro">información de registro</Link> (también puedes{' '}
        <Link href="/solicitar">solicitar tu inscripción</Link>).
      </p>
    </aside>
  );
}
