// RF-21 (021) · 21.1 a 21.3, RF-22 (021), RF-26 (021) · 26.1, D-T37 (021), D-T38 (021) · La invitación a jugar y el primer
// recorrido: una tarjeta sobre el borde del mapa, no un diálogo modal, para que el mapa siga a la vista y se pueda usar detrás.
// «Jugar» y «Cerrar» la marcan como vista (`onSeen`); el recorrido solo dice dónde mirar. Textos propuestos (plan §4).
// RF-3 (024), D-T3 (024): cada paso que muestra se avisa con `onStep`, para que el mapa se mueva a lo que el texto señala.
import { useState } from 'react';
import type { TourStep } from '../../shared/domain/tour';
import './WelcomeCard.css';

interface Props {
  steps: readonly TourStep[];
  /** La persona eligió «Jugar» o «Cerrar»: no se vuelve a mostrar en este navegador (RF-21 (021) · 21.3). */
  onSeen: () => void;
  /** La tarjeta se quita: «Cerrar», «Saltar el recorrido» o «Listo». */
  onClose: () => void;
  /** Se muestra un paso del recorrido (no la invitación ni al quitarse): el mapa se lleva a lo que señala (RF-3 (024)). */
  onStep?: (step: TourStep) => void;
}

export function WelcomeCard({ steps, onSeen, onClose, onStep }: Props) {
  /** `null` mientras invita; si no, el paso del recorrido a la vista. */
  const [step, setStep] = useState<number | null>(null);
  const current = step === null ? undefined : steps[step];
  const last = step !== null && step >= steps.length - 1;
  const goTo = (next: number) => {
    setStep(next);
    const target = steps[next];
    if (target !== undefined) onStep?.(target);
  };

  return (
    <section className="block welcome-card" aria-label="Bienvenida">
      {current === undefined ? (
        <>
          <h2 className="welcome-card__title">Te damos la bienvenida a APICCA</h2>
          <p className="welcome-card__text">
            Un mapa común para crear y conectar Acciones Comunes: cada edificio es un ápice que alguien propone, y cada camino une
            varios ápices en una acción a favor del bien común.
          </p>
          <div className="welcome-card__actions">
            <button
              type="button"
              className="block action-primary"
              onClick={() => {
                onSeen();
                goTo(0);
              }}
            >
              Jugar
            </button>
            <button
              type="button"
              className="block action-secondary"
              onClick={() => {
                onSeen();
                onClose();
              }}
            >
              Cerrar
            </button>
          </div>
        </>
      ) : (
        <>
          <div aria-live="polite">
            <p className="welcome-card__step">{`Paso ${(step ?? 0) + 1} de ${steps.length}`}</p>
            <h2 className="welcome-card__title">{current.title}</h2>
            <p className="welcome-card__text">{current.text}</p>
          </div>
          <div className="welcome-card__actions">
            {last ? (
              <button type="button" className="block action-primary" onClick={onClose}>
                Listo
              </button>
            ) : (
              <button type="button" className="block action-primary" onClick={() => goTo((step ?? 0) + 1)}>
                Siguiente
              </button>
            )}
            {!last && (
              <button type="button" className="block action-secondary" onClick={onClose}>
                Saltar el recorrido
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
