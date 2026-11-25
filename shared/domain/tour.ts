// RF-22 (021), RF-26 (021) · 26.1, 26.2, D-T38 (021): los pasos del primer recorrido. Dominio puro: el componente solo los
// muestra. Los textos son propuestos y por confirmar (plan §4, D-21 (003)). A qué Ápices lleva el mapa en cada paso se
// calcula en `tourFocus.ts`, aparte, porque necesita el teselado y no debe entrar en la carga inicial.

export type TourStepKey = 'apice' | 'camino' | 'construir';

export interface TourStep {
  readonly key: TourStepKey;
  readonly title: string;
  readonly text: string;
}

export interface TourInput {
  /** Ápices a la vista en el mapa. */
  readonly apices: number;
  /** Acciones Comunes a la vista en el mapa. */
  readonly paths: number;
  readonly signedIn: boolean;
}

/** Los pasos que el mapa puede mostrar, en orden; omite el que no tiene qué mostrar (RF-22 (021) · 22.3). */
export function tourSteps({ apices, paths, signedIn }: TourInput): TourStep[] {
  const steps: TourStep[] = [];
  if (apices > 0) steps.push({ key: 'apice', title: 'Mira un Ápice', text: 'Cada superficie de patrón es un Ápice. El mapa se acercó a uno: elígelo para ver su ficha.' });
  if (paths > 0) {
    steps.push({
      key: 'camino',
      title: 'Mira una Acción Común',
      text: 'Cada arco con nombre es una Acción Común que une Ápices. El mapa se acercó a una: elige su nombre para ver quién participa.',
    });
  }
  steps.push(
    signedIn
      ? { key: 'construir', title: 'Prototipa y conecta', text: 'Con «Prototipar un Ápice» propones el tuyo, y con «Conectar» unes varios en una Acción Común.' }
      : {
          key: 'construir',
          title: 'Prototipa y conecta',
          text: 'Para prototipar Ápices y conectarlos hace falta unirte a APICCA con «Unirme». Mientras tanto, «Prototipar un Ápice» te deja hacer un boceto que no se guarda.',
        },
  );
  return steps;
}
