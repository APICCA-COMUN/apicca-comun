// RF-3 (004) · 3.2, 3.4–3.6, D-T19 (004) · Página `/constitucion/secciones/:id`: historial de una sección, también de
// una retirada, para cuentas activas. Sin sesión lleva a `/entrar`; sin acción azul.
import { useEffect, useState } from 'react';
import type { Section, SectionVersion } from '../../shared/domain/constitution';
import { useSignInGuard } from '../app/returnTo';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { VersionList } from '../components/VersionList';
import { firestoreSectionsSource, type SectionsSource } from '../data/constitution/sections';

export function ConstitutionSection({ id, source = firestoreSectionsSource }: { id: string; source?: SectionsSource }) {
  usePageTitle({ area: 'Constitución', contentTitle: 'Historial de sección' });
  useSignInGuard();
  const session = useSession();
  const active = session.status === 'person';
  const [sections, setSections] = useState<Section[] | null>(null);
  const [versions, setVersions] = useState<SectionVersion[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const stopSections = source.onSections('member', setSections, () => setFailed(true));
    const stopVersions = source.onVersions('member', id, setVersions, () => setFailed(true));
    return () => {
      stopSections();
      stopVersions();
    };
  }, [active, id, source]);

  if (session.status === 'loading') return <p>Cargando…</p>;
  // Visitante: la redirección ya está en curso. Suspendida: `App` pinta el aviso de suspensión (RF-3 (004) · 3.6).
  if (!active) return null;

  const section = sections?.find((s) => s.id === id) ?? null;
  const loaded = sections !== null && versions !== null;
  const title = section?.title ?? versions?.[0]?.title ?? '';

  return (
    <div className="lot">
      {failed && <p role="alert">No se pudo leer el historial. Intenta de nuevo más tarde.</p>}
      {!loaded && !failed && <p>Cargando…</p>}
      {loaded && section === null && versions.length === 0 && (
        <div className="block block-empty">
          <p>No existe esa sección.</p>
        </div>
      )}
      {loaded && (section !== null || versions.length > 0) && (
        <>
          <h1>{title}</h1>
          {section?.isRetired === true && <p className="block">Sección retirada</p>}
          <h2>Versiones</h2>
          <VersionList versions={versions} />
        </>
      )}
      <p>
        <Link href="/constitucion/historial">Historial de la constitución</Link>
      </p>
    </div>
  );
}
