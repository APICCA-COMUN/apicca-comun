// RF-22 (021), RF-26 (021) · 26.1, 26.2, D-T38 (021): los pasos del primer recorrido. Dominio puro: el componente solo los
// muestra. Los textos son propuestos y por confirmar (plan §4, D-21 (003)).

export type TourStepKey = 'apice' | 'camino' | 'construir';

export interface TourStep {
  readonly key: TourStepKey;
  readonly title: string;
  readonly text: string;
}

export interface TourInput {
  /** Ápices a la vista en el mapa. */
  readonly apices: number;
  /** Caminos a la vista en el mapa. */
  readonly paths: number;
  readonly signedIn: boolean;
}

/** Los pasos que el mapa puede mostrar, en orden; omite el que no tiene qué mostrar (RF-22 (021) · 22.3). */
export function tourSteps({ apices, paths, signedIn }: TourInput): TourStep[] {
  const steps: TourStep[] = [];
  if (apices > 0) steps.push({ key: 'apice', title: 'Mira un ápice', text: 'Cada edificio es un ápice. Elige uno en el mapa para ver su ficha.' });
  if (paths > 0) {
    steps.push({ key: 'camino', title: 'Mira un camino', text: 'Cada camino es una Acción Común que une ápices. Elige su nombre para ver quién participa.' });
  }
  steps.push(
    signedIn
      ? { key: 'construir', title: 'Construye', text: 'Con «Construir ápice» propones el tuyo, y con «Trazar camino» unes varios en una Acción Común.' }
      : {
          key: 'construir',
          title: 'Construye',
          text: 'Para construir ápices y trazar caminos hace falta unirte a APICCA con «Unirme». Mientras tanto, «Construir ápice» te deja hacer un boceto que no se guarda.',
        },
  );
  return steps;
}
