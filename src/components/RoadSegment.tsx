// RF-9 (003) · 9.1 a 9.5, D-T9 (003) · Tramo de camino decorativo entre nodos o edificios. Sin texto ni foco.
// El grosor, los extremos y las uniones los fija `paths.css`; `tone` y `orientation` son opcionales.
export type RoadSegmentProps = {
  /** `surface` (por defecto) sobre el fondo de la página; `on-surface` dibuja el camino en `line` sobre un lote. */
  tone?: 'surface' | 'on-surface';
  /** `horizontal` (por defecto) o `vertical`, p. ej. para unir los principios de la constitución. */
  orientation?: 'horizontal' | 'vertical';
};

export function RoadSegment({ tone = 'surface', orientation = 'horizontal' }: RoadSegmentProps = {}) {
  const vertical = orientation === 'vertical';
  const className = ['road-segment', tone === 'on-surface' && 'road-segment--on-surface', vertical && 'road-segment--vertical']
    .filter(Boolean)
    .join(' ');
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      data-testid="road"
      viewBox={vertical ? '0 0 20 100' : '0 0 100 20'}
      preserveAspectRatio="none"
      fill="none"
    >
      <path d={vertical ? 'M 10 0 L 10 100' : 'M 0 10 L 100 10'} />
    </svg>
  );
}
