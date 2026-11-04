// RF-19 (019) · 19.1 a 19.3, 19.5, D-T22 (019) · Terreno de partida: cinco bases, una por eje, una frase y una sola acción
// primaria. Compacto, para que se vea entero en la primera pantalla a 360 px. La página elige la frase y la acción.
import { AXES } from '../../shared/domain/apice';
import { Link } from '../app/router';
import { AxisIcon } from './AxisIcon';
import './StartingTerrain.css';

interface Props {
  phrase: string;
  action: { label: string; href: string };
}

export function StartingTerrain({ phrase, action }: Props) {
  return (
    <section className="starting-terrain" aria-label="Terreno de partida">
      <div className="starting-terrain__bases">
        {AXES.map((axis) => (
          <span key={axis} className="starting-terrain__base">
            <AxisIcon axis={axis} labelled />
          </span>
        ))}
      </div>
      <p className="starting-terrain__phrase">{phrase}</p>
      <Link href={action.href} className="block action-primary">
        {action.label}
      </Link>
    </section>
  );
}
