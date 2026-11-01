// RF-2 (004) · 2.1, 2.2; RF-16 (004) · 16.3: bloque de una sección de la constitución con formato y enlaces.
// RF-11 (005) · 11.2, 11.3, D-T10 (005): con `number`, la tarjeta muestra en grande el número de la sección, en texto y
// con el color cíclico de un eje.
import { axisForIndex } from '../../shared/domain/constitution/axisCycle';
import type { Section, SectionMeta } from '../../shared/domain/constitution/types';
import { todayInColombia } from '../../shared/domain/dates';
import { parseMarkdown } from '../../shared/domain/docs/markdown';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { DocBlocks } from './DocBlocks';
import './SectionBlock.css';

export interface SectionBlockProps {
  section: Section;
  /** Posición de la sección en la constitución, desde 1. */
  number?: number;
  meta?: SectionMeta | null;
  /**
   * Indica si la persona tiene cuenta activa. Si no se especifica,
   * se determina con la sesión del usuario (`useSession()`).
   */
  hasActiveAccount?: boolean;
}

export function SectionBlock({ section, number, meta, hasActiveAccount }: SectionBlockProps) {
  const session = useSession();
  const isActive = hasActiveAccount ?? session.status === 'person';

  let contentBlocks;
  try {
    contentBlocks = parseMarkdown(section.text);
  } catch {
    contentBlocks = [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: section.text }] }];
  }

  const hasOpenAmendment = meta?.openAmendment !== null && meta?.openAmendment !== undefined;

  return (
    <article className="block section-block" id={`seccion-${section.id}`}>
      <header>
        <div className="section-block__title">
          {number !== undefined && (
            <span className="section-block__number" data-axis={axisForIndex(number - 1)}>
              {number}
            </span>
          )}
          <h2>{section.title}</h2>
        </div>
        <p className="section-meta">
          <time dateTime={todayInColombia(new Date(section.updatedAt))}>
            {todayInColombia(new Date(section.updatedAt))}
          </time>
          {isActive && meta && (
            <>
              {' · '}
              <span>Versión {meta.version}</span>
              {' · '}
              <span>Por {meta.proposedByUsername}</span>
            </>
          )}
        </p>
      </header>

      <div className="section-content">
        <DocBlocks blocks={contentBlocks} />
      </div>

      {isActive && (
        <footer className="section-footer">
          {hasOpenAmendment && meta?.openAmendment && (
            <p className="section-open-amendment">
              Propuesta abierta (cierre:{' '}
              <time dateTime={todayInColombia(new Date(meta.openAmendment.closesAt))}>
                {todayInColombia(new Date(meta.openAmendment.closesAt))}
              </time>
              )
            </p>
          )}
          <p className="section-history-links">
            <Link href="/constitucion/historial" className="action-secondary">
              Historial general
            </Link>
            {' · '}
            <Link href={`/constitucion/secciones/${section.id}`} className="action-secondary">
              Historial de la sección
            </Link>
          </p>
        </footer>
      )}
    </article>
  );
}
