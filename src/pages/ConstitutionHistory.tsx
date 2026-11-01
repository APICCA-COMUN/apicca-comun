// RF-3 (004) · 3.1, 3.4–3.6, D-T19 (004) · Página `/constitucion/historial`: el registro de cambios del conjunto
// (sección, tipo de cambio, quién y fecha) para cuentas activas. Sin sesión lleva a `/entrar`; sin acción azul.
import { useEffect, useState } from 'react';
import { todayInColombia } from '../../shared/domain/dates';
import { useSignInGuard } from '../app/returnTo';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { firestoreSectionsSource, type LogEntry, type SectionsSource } from '../data/constitution/sections';

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  opened: 'Apertura',
  changed: 'Cambiada',
  added: 'Añadida',
  removed: 'Retirada',
};

export function ConstitutionHistory({ source = firestoreSectionsSource }: { source?: SectionsSource }) {
  usePageTitle({ area: 'Constitución', contentTitle: 'Historial' });
  useSignInGuard();
  const session = useSession();
  const active = session.status === 'person';
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    return source.onLog('member', setEntries, () => setFailed(true));
  }, [active, source]);

  if (session.status === 'loading') return <p>Cargando…</p>;
  // Visitante: la redirección ya está en curso. Suspendida: `App` pinta el aviso de suspensión (RF-3 (004) · 3.6).
  if (!active) return null;

  return (
    <div className="lot">
      <h1>Historial de la constitución</h1>
      <p>
        <Link href="/constitucion">Volver a la constitución</Link>
      </p>
      {failed && <p role="alert">No se pudo leer el historial. Intenta de nuevo más tarde.</p>}
      {entries === null && !failed && <p>Cargando…</p>}
      {entries !== null && entries.length === 0 && (
        <div className="block block-empty">
          <p>Todavía no hay cambios registrados.</p>
        </div>
      )}
      {entries !== null && entries.length > 0 && (
        <div className="block">
          <table>
            <thead>
              <tr>
                <th scope="col">Sección</th>
                <th scope="col">Cambio</th>
                <th scope="col">Quién</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.seq}>
                  <td>
                    {entry.sectionId !== null ? (
                      <Link href={`/constitucion/secciones/${entry.sectionId}`}>{entry.sectionTitle ?? entry.sectionId}</Link>
                    ) : (
                      (entry.sectionTitle ?? '')
                    )}
                  </td>
                  <td>{KIND_LABEL[entry.kind]}</td>
                  <td>{entry.byUsername}</td>
                  <td>
                    <time dateTime={todayInColombia(new Date(entry.at))}>{todayInColombia(new Date(entry.at))}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
