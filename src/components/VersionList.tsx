// RF-3 (004) · 3.2, 3.5; RF-5 (004) · 5.4: lista de versiones históricas de una sección o documento.
import { INITIAL_AUTHOR, type SectionVersion } from '../../shared/domain/constitution/types';
import { todayInColombia } from '../../shared/domain/dates';

/** Forma mínima compatible para versiones de documentos (RF-5 (004) · 5.4). */
export interface DocumentVersionItem {
  version: number;
  at: number;
  byUsername?: string;
  proposedByUsername?: string;
  title?: string;
  text?: string;
}

export type VersionItem = SectionVersion | DocumentVersionItem;

export interface VersionListProps {
  versions: readonly VersionItem[];
}

function authorOf(version: VersionItem): string {
  if ('kind' in version && version.kind === 'initial') {
    return INITIAL_AUTHOR;
  }
  const username =
    'proposedByUsername' in version && version.proposedByUsername
      ? version.proposedByUsername
      : 'byUsername' in version && version.byUsername
      ? version.byUsername
      : '';
  if (username === '' || username === INITIAL_AUTHOR) {
    return INITIAL_AUTHOR;
  }
  return username;
}

export function VersionList({ versions }: VersionListProps) {
  if (versions.length === 0) {
    return (
      <div className="block block-empty">
        <p>No hay versiones registradas.</p>
      </div>
    );
  }

  return (
    <ol className="lot lot-versions" aria-label="Historial de versiones">
      {versions.map((v) => {
        const hasAgreements = 'agreementsCounted' in v && v.agreementsCounted !== undefined;
        const hasObjections =
          ('objectionsResolved' in v && v.objectionsResolved !== undefined) ||
          ('objectionsWithdrawn' in v && v.objectionsWithdrawn !== undefined);

        return (
          <li key={v.version} className="block version-item">
            <h3>Versión {v.version}</h3>
            <p className="version-meta">
              <time dateTime={todayInColombia(new Date(v.at))}>{todayInColombia(new Date(v.at))}</time> · {authorOf(v)}
            </p>
            {hasAgreements && (
              <p className="version-agreements">
                {v.agreementsCounted} {v.agreementsCounted === 1 ? 'acuerdo' : 'acuerdos'}{' '}
                {v.authorAgreementCounted ? '(incluye el de quien propuso)' : '(sin el de quien propuso)'}
              </p>
            )}
            {hasObjections && (
              <p className="version-objections">
                Objeciones: {v.objectionsResolved ?? 0}{' '}
                {(v.objectionsResolved ?? 0) === 1 ? 'resuelta' : 'resueltas'}, {v.objectionsWithdrawn ?? 0}{' '}
                {(v.objectionsWithdrawn ?? 0) === 1 ? 'retirada' : 'retiradas'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
