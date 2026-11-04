// RF-6 (008) · 6.6 a 6.10, D-10 (008), RF-10 (003) · 10.1 a 10.4, 10.6 a 10.8, RF-9 (003) · 9.4, RNF-5 (003), D-T11 (003),
// RF-16 (019) · 16.1 a 16.3, D-6 (019), D-7 (019), D-16 (019), D-T10 (019) · Inicio: qué es APICCA, un mapa
// ilustrado con su rótulo «Así se verá el terreno», la acción principal según la sesión, los cinco ejes, tres pasos sobre un
// camino con la marca «Pronto» si aplica, y los enlaces a Prototipado y a la Constitución de APICCA COMÚN.
import { AXES } from '../../shared/domain/apice';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { AXIS_LABEL, AxisIcon } from '../components/AxisIcon';
import { MapIllustration } from '../components/MapIllustration';
import { Node } from '../components/Node';
import { RoadSegment } from '../components/RoadSegment';
import { HOME_CONTENT } from './homeContent';
import './Home.css';

export function Home() {
  usePageTitle({});
  const session = useSession();
  return (
    <>
      <header className="home__hero">
        <div className="home__hero-text">
          <h1>Encuéntrate y co-crea con otras personas</h1>
          <p>Un marco de apoyo mutuo para crear juntas agua, alimento, cobijo, energía y comunicación.</p>
          <div className="home__actions">
            {session.status === 'person' && (
              <Link href="/apices/nuevo" className="block action-primary">
                Nuevo ápice
              </Link>
            )}
            {session.status === 'visitor' && (
              <Link href="/solicitar" className="block action-primary">
                Pide tu inscripción
              </Link>
            )}
            <Link href="/prototipado">Ver los ápices</Link>
          </div>
        </div>
        <div className="home__hero-map">
          <p className="home__map-label">Así se verá el terreno</p>
          <MapIllustration />
        </div>
      </header>
      <section className="home__section" aria-labelledby="home-axes">
        <h2 id="home-axes">Un ápice conecta cinco ejes de autonomía compartida.</h2>
        <ul className="home__axes">
          {AXES.map((axis) => (
            <li key={axis} className="block home__axis" data-axis={axis}>
              <AxisIcon axis={axis} />
              <h3>{AXIS_LABEL[axis]}</h3>
              <p>{HOME_CONTENT.axes[axis]}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="home__section" aria-labelledby="home-steps">
        <h2 id="home-steps">Cómo funciona</h2>
        <ol className="home__steps">
          {HOME_CONTENT.steps.map((step, index) => (
            <li key={index} className="home__step">
              <span className="home__step-mark">
                <Node />
                {index < HOME_CONTENT.steps.length - 1 && (
                  <>
                    <span className="home__step-road home__step-road--row">
                      <RoadSegment />
                    </span>
                    <span className="home__step-road home__step-road--column">
                      <RoadSegment orientation="vertical" />
                    </span>
                  </>
                )}
              </span>
              <div className="home__step-text">
                <h3>
                  {step.title}
                  {step.soon ? <> <span className="home__step-soon">Pronto</span></> : null}
                </h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="home__closing" aria-labelledby="home-closing">
        <h2 id="home-closing">Nada se compra ni se vende: se hace juntas.</h2>
        <Link href="/constitucion">Leer la Constitución de APICCA COMÚN</Link>
      </section>
    </>
  );
}
