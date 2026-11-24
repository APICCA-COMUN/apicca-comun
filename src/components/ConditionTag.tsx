// RF-13 (002) · 13.1 a 13.3, RF-6 (003) · 6.1, 6.2, D-T20 (003) · Etiqueta de condición de un ápice: un rótulo con el texto
// de la condición (ConditionTag.css). La condición está en la palabra, no en el color ni en un punto (QA #21.2).
import type { ReactNode } from 'react';
import './ConditionTag.css';

export type Condition = 'visibility' | 'archived' | 'status';

export function ConditionTag({ condition, children }: { condition: Condition; children: ReactNode }) {
  return (
    <span className="tag" data-condition={condition}>
      {children}
    </span>
  );
}
