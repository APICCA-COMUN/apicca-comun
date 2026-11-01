// RF-10 (003) · 10.8, D-21 (003), D-T11 (003) · Textos del inicio: una frase por eje y tres pasos de participación.
// Es un módulo de datos que redacta la persona; las pruebas verifican la estructura, no el texto.
import type { Axis } from '../../shared/domain/apice';

export interface HomeContent {
  /** Una frase que describe cada eje, por clave de eje. */
  axes: Record<Axis, string>;
  /** Los tres pasos de cómo se participa, con título y texto (D-10 (008)). */
  steps: readonly [HomeStep, HomeStep, HomeStep];
}

export interface HomeStep {
  title: string;
  text: string;
}

// Textos del artboard «Inicio» (D-10 (008)).
export const HOME_CONTENT: HomeContent = {
  axes: {
    agua: 'Captar y cuidar el agua.',
    alimento: 'Sembrar y repartir la cosecha.',
    cobijo: 'Construir lugares donde reunirse.',
    energía: 'Producir luz y calor entre todas.',
    comunicación: 'Mantener abiertos los canales.',
  },
  steps: [
    { title: 'Encontrarse', text: 'Llegas por invitación o pides tu inscripción.' },
    { title: 'Proponer una Acción Común', text: 'Te comprometes con un ápice y otras se suman.' },
    { title: 'Co-crear', text: 'Se hace entre varias y queda una hebra.' },
  ],
};
