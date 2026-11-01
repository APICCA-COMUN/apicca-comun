// RF-13 (002) · 13.1 a 13.3, RF-6 (003) · 6.1, 6.2, D-T20 (003) · Etiqueta de condición de un ápice: un punto
// decorativo y el texto de la 001 (ConditionTag.css). La condición está en el texto, no en el color.
import type { ReactNode } from 'react';
import './ConditionTag.css';

export type Condition = 'visibility' | 'archived' | 'status' | 'reference';

export function ConditionTag({ condition, children }: { condition: Condition; children: ReactNode }) {
  return (
    <span className="tag" data-condition={condition}>
      <span className="tag-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
