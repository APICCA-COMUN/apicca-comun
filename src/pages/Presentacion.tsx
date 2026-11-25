// RF-11 (021) · 11.1, excepción temporal: hasta el lanzamiento oficial, quien llega sin sesión a «/» ve esta página y no el mapa.
// Presentación previa al lanzamiento (25-11-2026; la persona eligió que vaya en «/» para quien llega sin sesión, sin
// fecha). Diseño y textos nuevos: Propuesta del asistente, en «E3 · Celda» (docs/sistema-mapa/celda.md); los textos que no
// salen de la documentación están en respaldos/rediseno-mapa/textos-propuestos.md, sección «Presentación».
//
// La portada repite el orden del Inicio: la columna a la izquierda y el mapa a la derecha. El mapa es un campo de muestra
// (`presentacionCampo.ts`), decorativo: lo que dice, lo dice también el texto de al lado. La leyenda es el control, como en
// el sitio: tocar un eje apaga el color de los demás Ápices y un Arco une los que lo tienen. Sin datos reales ni llamadas
// a la base: la página no lee nada.
import { useId, useMemo, useState, type CSSProperties } from 'react';
import { AXES, APICE_STAGE_LABEL, APICE_STATUSES, type Axis } from '../../shared/domain/apice';
import { axisIdentity } from '../../shared/domain/identity';
import { arcHalo, arcStroke, buildArc } from '../../shared/domain/mapArcs';
import { Link } from '../app/router';
import { usePageTitle } from '../app/usePageTitle';
import { AXIS_LABEL } from '../components/AxisIcon';
import { Celda, CeldaSuperficie, HexSuperficie, celdaAlto } from '../components/Celda';
import { Glifo, Icono } from '../components/Glifo';
import { Logo } from '../components/Logo';
import { PiezaArco, type ApicePieza } from '../components/PiezaArco';
import { SessionEntry } from '../components/SessionEntry';
import { ThemeToggle } from '../components/ThemeToggle';
import { CAMPO_R, apicesConEje, campoPresentacion, type Campo } from './presentacionCampo';
import '../components/LeyendaControl.css';
import '../components/SiteHeader.css';
import './Presentacion.css';

/** La Acción Común de la sección «Qué hay»: cuatro Ápices de muestra, con el eje sobre el arco del medio. */
const MUESTRA_ACCION: readonly ApicePieza[] = [
  { id: 'a', name: 'Muestra 1', axes: ['agua'], status: 'en marcha' },
  { id: 'b', name: 'Muestra 2', axes: ['agua', 'alimento'], status: 'prototipo' },
  { id: 'c', name: 'Muestra 3', axes: ['cobijo', 'agua'], status: 'idea' },
  { id: 'd', name: 'Muestra 4', axes: ['agua', 'energía'], status: 'prototipo' },
];

/** El ancho de las celdas de la leyenda, como en `LeyendaControl`. */
const CELDA_LEYENDA = 40;

type Estilo = CSSProperties & Record<`--${string}`, string | number>;

/** El campo de muestra: zonas, trama, Ápices y el Arco del eje elegido (o el de muestra). Decorativo. */
function CampoMuestra({ campo, eje }: { campo: Campo; eje: Axis | null }) {
  const uid = useId().replace(/[^\w-]/g, '');
  const paradas = eje === null ? campo.arcoInicial.map((id) => campo.apices.find((apice) => apice.id === id)!) : apicesConEje(campo, eje);
  const arco = buildArc(paradas, CAMPO_R, { apices: campo.apices });
  const alto = celdaAlto(CAMPO_R * 2);
  const halo = arcHalo(CAMPO_R);
  const trazo = arcStroke(CAMPO_R);
  return (
    <svg
      className="presentacion__mapa"
      viewBox={`0 0 ${campo.ancho} ${campo.alto}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path className="presentacion__trama" d={campo.trama} />
      {campo.zonas.map((zona) => (
        <polygon key={zona.key} className="presentacion__zona" points={zona.contorno} style={{ '--i': zona.orden } as Estilo} />
      ))}
      {campo.apices.map((apice) => (
        <g
          key={apice.id}
          className="presentacion__apice"
          data-off={eje !== null && !apice.axes.includes(eje) ? 'true' : undefined}
          style={{ '--i': apice.orden } as Estilo}
        >
          <HexSuperficie axes={apice.axes} status={apice.status} ancho={CAMPO_R * 2} x={apice.x - CAMPO_R} y={apice.y - alto / 2} uid={`${uid}-${apice.id}`} />
        </g>
      ))}
      {arco !== null && (
        // La clave cambia con el eje: el Arco se vuelve a montar y se dibuja de nuevo, tramo a tramo.
        <g key={eje ?? 'muestra'} className="presentacion__arco" data-inicial={eje === null ? 'true' : undefined}>
          {arco.segments.map((segment, index) => (
            <path key={`h${index}`} className="presentacion__arco-halo" d={segment.d} pathLength={1} style={{ strokeWidth: halo, '--t': index } as Estilo} />
          ))}
          {arco.segments.map((segment, index) => (
            <path key={`s${index}`} className="presentacion__arco-trazo" d={segment.d} pathLength={1} style={{ strokeWidth: trazo, '--t': index } as Estilo} />
          ))}
          {arco.discs.map((disc, index) => (
            <g key={`d${index}`} className="presentacion__arco-parada" style={{ '--t': Math.max(0, index - 1) } as Estilo}>
              <circle className="presentacion__arco-disco-halo" cx={disc.x} cy={disc.y} r={disc.r + (halo - trazo) / 2} />
              <circle className="presentacion__arco-disco" cx={disc.x} cy={disc.y} r={disc.r} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/** La leyenda del campo: cinco ejes, uno a la vez. Tocar el elegido lo suelta. */
function LeyendaMuestra({ eje, onEje }: { eje: Axis | null; onEje: (eje: Axis | null) => void }) {
  return (
    <div className="presentacion__leyenda leyenda-control__fila leyenda-control__fila--ejes" role="group" aria-label="Ejes de la muestra">
      {AXES.map((axis) => {
        const elegido = eje === axis;
        const encendido = eje === null || elegido;
        const { key } = axisIdentity(axis);
        return (
          <button
            key={axis}
            type="button"
            className="leyenda-control__boton"
            aria-label={AXIS_LABEL[axis]}
            aria-pressed={elegido}
            data-encendido={encendido ? 'true' : 'false'}
            onClick={() => onEje(elegido ? null : axis)}
          >
            <span className="leyenda-control__celda">
              {encendido ? (
                <Celda
                  ancho={CELDA_LEYENDA}
                  contorno="var(--contorno-superficie)"
                  grosor={elegido ? 4 : 2}
                  formaClassName={`leyenda-control__superficie leyenda-control__superficie--${key}`}
                >
                  <span className="leyenda-control__glifo">
                    <Glifo axis={axis} size={20} tile={false} />
                  </span>
                </Celda>
              ) : (
                <Celda
                  ancho={CELDA_LEYENDA}
                  relleno="var(--background)"
                  contorno="var(--trama)"
                  grosor={2}
                  formaClassName="presentacion__leyenda-apagada"
                >
                  <span className="leyenda-control__glifo leyenda-control__glifo--apagado">
                    <Glifo axis={axis} size={20} tile={false} mode="contorno" />
                  </span>
                </Celda>
              )}
            </span>
            <span
              className={`leyenda-control__nombre${encendido ? '' : ' c-suave'}${elegido ? ' leyenda-control__nombre--elegido' : ''}`}
              aria-hidden="true"
            >
              {axis}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Qué dice el campo, en texto: lo leen también los lectores de pantalla (el dibujo es decorativo). */
export function estadoDelCampo(campo: Campo, eje: Axis | null): string {
  if (eje === null) return `Acción Común de muestra: un arco une ${campo.arcoInicial.length} Ápices de ejes distintos.`;
  const n = apicesConEje(campo, eje).length;
  return `${AXIS_LABEL[eje]}: se encienden ${n} Ápices y un arco los une.`;
}

/** Una celda de tinta con un número, como el «+N» del mapa: marca los pasos de «Cómo entrar». */
function Paso({ n }: { n: number }) {
  return (
    <Celda ancho={44} relleno="var(--text)" className="presentacion__paso-celda">
      <span className="presentacion__paso-cifra">{n}</span>
    </Celda>
  );
}

/** La cabecera de la presentación: el logo, el tema y «Entrar». Sin navegación. La pinta `App.tsx`, fuera del `<main>`. */
export function PresentacionCabecera() {
  return (
    <header className="site-header presentacion__cabecera">
      <div className="site-header__inner">
        <Logo />
        <div className="site-header__actions">
          <ThemeToggle />
          <SessionEntry />
        </div>
      </div>
    </header>
  );
}

/** El contenido de la presentación: las secciones que van dentro del `<main>` que pinta `App.tsx`. */
export function Presentacion() {
  usePageTitle({});
  const campo = useMemo(campoPresentacion, []);
  const [eje, setEje] = useState<Axis | null>(null);
  return (
    <>
      <section className="presentacion__portada" aria-labelledby="presentacion-titulo">
        <div className="presentacion__columna">
          <div className="c-seccion presentacion__aviso">
            <p className="c-rot c-rot--ajuste">Lanzamiento oficial en preparación</p>
          </div>
          {/* Las letras de la sigla y la última palabra van en tinta y el resto, en suave: se lee «APICCA» y, al final,
              «Comunes», de donde sale el COMÚN del nombre. El dibujo parte palabras en dos piezas; el lector de pantalla
              lee la frase entera. */}
          <h1 id="presentacion-titulo" className="presentacion__titulo">
            <span className="visually-hidden">API para Crear y Conectar Acciones Comunes</span>
            <span aria-hidden="true">
              <span className="presentacion__sigla">API</span> <span className="presentacion__resto">para</span>{' '}
              <span className="presentacion__sigla">C</span>
              <span className="presentacion__resto">rear y</span> <span className="presentacion__sigla">C</span>
              <span className="presentacion__resto">onectar</span> <span className="presentacion__sigla">A</span>
              <span className="presentacion__resto">cciones</span> <span className="presentacion__sigla">Comunes</span>
            </span>
          </h1>
          <p className="presentacion__entradilla">
            Hacia nuevas economías recíprocas
          </p>
          <div className="presentacion__acciones">
            <Link href="/solicitar" className="c-barra presentacion__barra">
              Solicitar inscripción
              <Icono name="avanzar" size={14} />
            </Link>
            <Link href="/documentacion/que-es-apicca" className="c-enlace">
              Qué es APICCA
            </Link>
          </div>
          <p className="c-cuerpo c-suave presentacion__nota">
            Mientras preparamos el lanzamiento oficial, el mapa está abierto a las personas inscritas. Si ya tienes cuenta,{' '}
            <Link href="/entrar" className="presentacion__enlace-texto">
              entra
            </Link>
            .
          </p>
        </div>

        <div className="presentacion__campo">
          <div className="c-seccion presentacion__campo-cabeza">
            <span className="c-rot c-rot--ajuste">Cinco ejes · toca uno</span>
            <span className="c-rot c-rot--ajuste c-suave">Muestra ilustrativa</span>
          </div>
          <CampoMuestra campo={campo} eje={eje} />
          <div className="presentacion__campo-pie">
            <LeyendaMuestra eje={eje} onEje={setEje} />
            <p className="c-cuerpo presentacion__estado" aria-live="polite">
              {estadoDelCampo(campo, eje)}
            </p>
          </div>
        </div>
      </section>

      <section className="presentacion__seccion" aria-labelledby="presentacion-ideas">
        <div className="c-seccion">
          <h2 id="presentacion-ideas" className="c-rot presentacion__rotulo">
            Se apoya en tres ideas
          </h2>
        </div>
        <ul className="presentacion__ideas">
          <li className="presentacion__idea">
            <span className="presentacion__idea-nombre">Apoyo mutuo</span>
          </li>
          <li className="presentacion__idea">
            <span className="presentacion__idea-nombre" lang="en">
              Commoning
            </span>
            <span className="c-cuerpo c-suave">Cuidar y gestionar entre todas lo que es de todas.</span>
          </li>
          <li className="presentacion__idea">
            <span className="presentacion__idea-nombre">Economías recíprocas</span>
            <span className="c-cuerpo c-suave">Las que no pasan por el dinero.</span>
          </li>
        </ul>
      </section>

      <section className="presentacion__seccion" aria-labelledby="presentacion-que-hay">
        <div className="c-seccion">
          <h2 id="presentacion-que-hay" className="c-rot presentacion__rotulo">
            Qué hay en APICCA
          </h2>
          <span className="c-rot c-suave" aria-hidden="true">
            01–03
          </span>
        </div>
        <ol className="presentacion__modulos">
          <li className="presentacion__modulo">
            <span className="c-num presentacion__num" aria-hidden="true">
              01
            </span>
            <h3 className="c-nombre">Ápices</h3>
            <ul className="presentacion__etapas" aria-label="Etapas">
              {APICE_STATUSES.map((status) => (
                <li key={status} className="presentacion__etapa">
                  <CeldaSuperficie axes={['agua', 'alimento']} status={status} ancho={56} />
                  <span className="c-rot">{APICE_STAGE_LABEL[status]}</span>
                </li>
              ))}
            </ul>
            <p className="c-cuerpo">
              Un Ápice es un lugar de encuentro donde se prepara una idea, un prototipo o una iniciativa en marcha. Cada uno conecta uno
              o más de cinco ejes de autonomía compartida: agua, alimento, cobijo, energía y comunicación.
            </p>
          </li>
          <li className="presentacion__modulo">
            <span className="c-num presentacion__num" aria-hidden="true">
              02
            </span>
            <h3 className="c-nombre">Acciones Comunes</h3>
            <div className="presentacion__figura" aria-hidden="true">
              <PiezaArco apices={MUESTRA_ACCION} ancho={300} alto={96} cel={40} eje="agua" />
            </div>
            <p className="c-cuerpo">
              Son la base del apoyo mutuo: acciones reales a favor del bien común. En el mapa, cada Acción Común es un arco que une varios
              Ápices.
            </p>
          </li>
          <li className="presentacion__modulo">
            <span className="c-num presentacion__num" aria-hidden="true">
              03
            </span>
            <h3 className="c-nombre">Constitución común</h3>
            <ol className="presentacion__pasos-reglas" aria-label="Cómo cambia">
              <li className="c-art">
                <span>Proponer</span>
                <span className="c-suave" aria-hidden="true">
                  1
                </span>
              </li>
              <li className="c-art">
                <span>Deliberar</span>
                <span className="c-suave" aria-hidden="true">
                  2
                </span>
              </li>
              <li className="c-art">
                <span>Acordar u objetar</span>
                <span className="c-suave" aria-hidden="true">
                  3
                </span>
              </li>
            </ol>
            <p className="c-cuerpo">
              Las reglas del sitio son de las personas que lo habitan y solo cambian por propuestas abiertas a todas las personas
              inscritas.
            </p>
          </li>
        </ol>
      </section>

      <section className="presentacion__seccion presentacion__entrar" aria-labelledby="presentacion-entrar">
        <div className="c-seccion">
          <h2 id="presentacion-entrar" className="c-rot presentacion__rotulo">
            Cómo entrar
          </h2>
          <span className="c-rot c-suave">Por invitación</span>
        </div>
        <div className="presentacion__entrar-cuerpo">
          <p className="presentacion__entradilla">
            En APICCA se entra por invitación. Así el espacio lo habitan solo las personas que alguien de la facilitación aceptó, y cada
            cuenta queda ligada a un correo.
          </p>
          <ol className="presentacion__pasos">
            <li className="presentacion__paso">
              <Paso n={1} />
              <div>
                <h3 className="presentacion__paso-titulo">Solicita tu inscripción</h3>
                <p className="c-cuerpo c-suave">Con tu correo, tu nombre y un mensaje para contar quién eres y por qué quieres participar.</p>
              </div>
            </li>
            <li className="presentacion__paso">
              <Paso n={2} />
              <div>
                <h3 className="presentacion__paso-titulo">La facilitación la revisa</h3>
                <p className="c-cuerpo c-suave">Si la acepta, te hace llegar un enlace de invitación.</p>
              </div>
            </li>
            <li className="presentacion__paso">
              <Paso n={3} />
              <div>
                <h3 className="presentacion__paso-titulo">Creas tu acceso</h3>
                <p className="c-cuerpo c-suave">Eliges una contraseña, tu nombre y tu nombre de usuario, y ya puedes crear tu primer Ápice.</p>
              </div>
            </li>
          </ol>
          <div className="presentacion__acciones">
            <Link href="/solicitar" className="c-barra presentacion__barra">
              Solicitar inscripción
              <Icono name="avanzar" size={14} />
            </Link>
            <Link href="/entrar" className="c-enlace">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      <section className="presentacion__cierre" aria-label="Cierre">
        <p className="presentacion__frase">Lo común se hace entre varias, a la vista y con memoria de lo que cada quien aportó.</p>
        <div className="presentacion__firma" aria-hidden="true">
          {AXES.map((axis) => (
            <Celda
              key={axis}
              ancho={48}
              contorno="var(--contorno-superficie)"
              grosor={2}
              formaClassName={`leyenda-control__superficie leyenda-control__superficie--${axisIdentity(axis).key}`}
            >
              <span className="leyenda-control__glifo">
                <Glifo axis={axis} size={22} tile={false} />
              </span>
            </Celda>
          ))}
        </div>
      </section>
    </>
  );
}
