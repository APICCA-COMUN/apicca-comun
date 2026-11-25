// RF-23 (021) · 23.1 a 23.3, 23.5, RF-26 (021) · 26.2, D-12 (021), D-T39 (021) · El boceto del visitante: dice primero que
// no se guarda ni lo ven otras personas, deja elegir ejes y etapa, muestra el Ápice que resulta (en una ficha: la superficie
// arriba y el rótulo debajo) y termina en una sola acción, unirse. Quien lo pinta (Play) guarda el boceto en este
// navegador y lo pone en el mapa. Textos propuestos (plan §4).
import { useId } from 'react';
import { APICE_STAGE_LABEL, APICE_STATUSES, type ApiceStatus } from '../../shared/domain/apice';
import { Link } from '../app/router';
import type { Sketch } from '../app/sketch';
import { usePageTitle } from '../app/usePageTitle';
import { AxisPicker } from './AxisPicker';
import { CeldaSuperficie } from './Celda';
import { superficieLabel } from './Superficie';
import './SketchPanel.css';

interface Props {
  sketch: Sketch;
  onChange: (sketch: Sketch) => void;
}

export function SketchPanel({ sketch, onChange }: Props) {
  usePageTitle({ contentTitle: 'Boceto' });
  const statusId = useId();
  return (
    <section className="sketch-panel">
      <h1>Haz un boceto</h1>
      <p className="block sketch-panel__notice">Este boceto no se guarda ni lo ven otras personas: vive solo en este navegador.</p>
      <AxisPicker value={sketch.axes} onChange={(axes) => onChange({ ...sketch, axes })} />
      <div className="sketch-panel__field">
        <label htmlFor={statusId}>Etapa</label>
        <select className="block" id={statusId} value={sketch.status} onChange={(event) => onChange({ ...sketch, status: event.target.value as ApiceStatus })}>
          {APICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {APICE_STAGE_LABEL[status]}
            </option>
          ))}
        </select>
      </div>
      {sketch.axes.length === 0 ? (
        <p>Elige al menos un eje para ver tu Ápice.</p>
      ) : (
        <figure className="sketch-panel__preview">
          <div className="sketch-panel__celda">
            <CeldaSuperficie axes={sketch.axes} status={sketch.status} ancho={176} grosor={2} label={superficieLabel(sketch.axes, sketch.status)} />
          </div>
          <figcaption>
            <strong>Boceto</strong>
            <span className="sketch-panel__rotulo">
              {sketch.axes.join(' y ')} · {sketch.status}
            </span>
          </figcaption>
        </figure>
      )}
      <p>Para prototiparlo de verdad, en el mapa común, únete a APICCA.</p>
      <p>
        <Link href="/solicitar" className="block action-primary">
          Unirme para prototiparlo
        </Link>
      </p>
    </section>
  );
}
