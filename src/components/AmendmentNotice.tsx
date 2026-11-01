// RF-15 (004) · 15.1: aviso de propuestas abiertas para personas con cuenta activa.
import { todayInColombia } from '../../shared/domain/dates';
import { Link } from '../app/router';
import { useSession } from '../app/session';

export interface AmendmentNoticeProps {
  /** Cantidad de propuestas abiertas. */
  openCount: number;
  /** Instante en milisegundos del cierre más próximo. */
  nextClosesAt?: number | null;
  /**
   * Indica si la persona tiene cuenta activa. Si no se especifica,
   * se determina con la sesión del usuario (`useSession()`).
   */
  hasActiveAccount?: boolean;
}

export function AmendmentNotice({ openCount, nextClosesAt, hasActiveAccount }: AmendmentNoticeProps) {
  const session = useSession();
  const isActive = hasActiveAccount ?? session.status === 'person';

  if (!isActive || openCount <= 0) {
    return null;
  }

  const countText = openCount === 1 ? 'Hay 1 propuesta abierta' : `Hay ${openCount} propuestas abiertas`;
  const dateFormatted =
    nextClosesAt !== undefined && nextClosesAt !== null ? todayInColombia(new Date(nextClosesAt)) : null;

  return (
    <aside className="block amendment-notice" role="status" aria-label="Aviso de propuestas abiertas">
      <p>
        {countText}
        {dateFormatted !== null && ` · Cierre más próximo: ${dateFormatted}`}.
      </p>
      <Link href="/constitucion/propuestas" className="block action-secondary">
        Ver propuestas
      </Link>
    </aside>
  );
}
