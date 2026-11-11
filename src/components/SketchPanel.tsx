// RF-23 (021) · 23.1 a 23.3, 23.5, RF-26 (021) · 26.2, D-12 (021), D-T39 (021) · El boceto del visitante: dice primero que
// no se guarda ni lo ven otras personas, deja elegir ejes y etapa, muestra el edificio que resulta y termina en una sola
// acción, unirse. Quien lo pinta (Play) guarda el boceto en este navegador y lo pone en el mapa. Textos propuestos (plan §4).
import { useId } from 'react';
import { APICE_STAGE_LABEL, APICE_STATUSES, type ApiceStatus } from '../../shared/domain/apice';
import { Link } from '../app/router';
import type { Sketch } from '../app/sketch';
import { usePageTitle } from '../app/usePageTitle';
import { AxisPicker } from './AxisPicker';
import { Building } from './Building';
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
        <p>Elige al menos un eje para ver tu edificio.</p>
      ) : (
        <figure className="sketch-panel__preview">
          <Building axes={sketch.axes} stage={sketch.status} seed="boceto" max={2} />
          <figcaption>Boceto</figcaption>
        </figure>
      )}
      <p>Para construirlo de verdad, en el mapa común, únete a APICCA.</p>
      <p>
        <Link href="/solicitar" className="block action-primary">
          Unirme para construirlo
        </Link>
      </p>
    </section>
  );
}
