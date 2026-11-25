// RF-15 (019) · 15.2 · «E3 · Celda» (24-11-2026, Propuesta del asistente): la leyenda es el control. Tres grupos de celdas que se tocan: «Filtrar
// por eje» (cinco celdas con glifo), «Etapa» (tres muestras de patrón) y «Nivel» (tres hexágonos de 16, 24 y 32 px).
// Cada celda es un botón con `aria-pressed`, nombre accesible y un área de al menos 48 × 48 px. El color nunca es la única
// señal: una celda de eje encendida lleva color, contorno de tinta y glifo macizo; la apagada, papel, contorno suave y
// glifo en línea. La elegida entre las Etapas lleva contorno grueso y subrayado; el nivel activo, hexágono lleno.
// Semántica del filtro: sin ejes elegidos no hay filtro y las cinco se ven encendidas (con `aria-pressed` falso); al tocar
// un eje, el componente solo avisa (`onEje`) y quien lo usa decide. Un grupo opcional sin su manejador no se dibuja.
import { AXES, APICE_STAGE_LABEL, APICE_STATUSES, type Axis, type ApiceStatus } from '../../shared/domain/apice';
import { axisIdentity } from '../../shared/domain/identity';
import { AXIS_LABEL } from './AxisIcon';
import { Celda, CeldaSuperficie } from './Celda';
import { Glifo } from './Glifo';
import './LeyendaControl.css';

type Nivel = 0 | 1 | 2;

interface LeyendaControlProps {
  /** Los ejes elegidos; vacío = sin filtro (todos se ven encendidos). */
  ejes: readonly Axis[];
  onEje: (eje: Axis) => void;
  etapa: ApiceStatus | null;
  onEtapa: (etapa: ApiceStatus | null) => void;
  /** Nivel del mapa: 0 es el más cercano y 2, el más alejado. Sin `onNivel`, el grupo no se dibuja. */
  nivel?: Nivel;
  onNivel?: (nivel: Nivel) => void;
  /** Quita todos los filtros; el enlace aparece solo si hay alguno. */
  onQuitar?: () => void;
}

const ANCHO_CELDA = 40;

/** De izquierda a derecha, del más alejado al más cercano: hexágonos de 16, 24 y 32 px. */
const NIVELES: readonly { nivel: Nivel; ancho: number; nombre: string }[] = [
  { nivel: 2, ancho: 16, nombre: 'Nivel 2, el más alejado' },
  { nivel: 1, ancho: 24, nombre: 'Nivel 1' },
  { nivel: 0, ancho: 32, nombre: 'Nivel 0, el más cercano' },
];

export function LeyendaControl({ ejes, onEje, etapa, onEtapa, nivel, onNivel, onQuitar }: LeyendaControlProps) {
  const hayFiltro = ejes.length > 0 || etapa !== null;
  return (
    <div className="leyenda-control">
      <div className="leyenda-control__grupos">
        <div className="leyenda-control__grupo leyenda-control__grupo--ejes" role="group" aria-label="Filtrar por eje">
          <div className="c-seccion">
            <span className="c-rot">Filtrar por eje</span>
          </div>
          <div className="leyenda-control__fila leyenda-control__fila--ejes">
            {AXES.map((axis) => {
              const elegido = ejes.includes(axis);
              const encendido = ejes.length === 0 || elegido;
              const { key } = axisIdentity(axis);
              return (
                <button
                  key={axis}
                  type="button"
                  className="leyenda-control__boton"
                  aria-label={AXIS_LABEL[axis]}
                  aria-pressed={elegido}
                  data-encendido={encendido ? 'true' : 'false'}
                  onClick={() => onEje(axis)}
                >
                  <span className="leyenda-control__celda">
                    {encendido ? (
                      <Celda
                        ancho={ANCHO_CELDA}
                        contorno="var(--contorno-superficie)"
                        grosor={2}
                        formaClassName={`leyenda-control__superficie leyenda-control__superficie--${key}`}
                      >
                        <span className="leyenda-control__glifo">
                          <Glifo axis={axis} size={20} tile={false} />
                        </span>
                      </Celda>
                    ) : (
                      <Celda ancho={ANCHO_CELDA} relleno="var(--background)" contorno="var(--trama)" grosor={2}>
                        <span className="leyenda-control__glifo leyenda-control__glifo--apagado">
                          <Glifo axis={axis} size={20} tile={false} mode="contorno" />
                        </span>
                      </Celda>
                    )}
                  </span>
                  <span className={`leyenda-control__nombre${encendido ? '' : ' c-suave'}`} aria-hidden="true">
                    {axis}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="leyenda-control__grupo leyenda-control__grupo--etapa" role="group" aria-label="Etapa">
          <div className="c-seccion">
            <span className="c-rot">Etapa</span>
          </div>
          <div className="leyenda-control__fila">
            {APICE_STATUSES.map((status) => {
              const elegida = etapa === status;
              return (
                <button
                  key={status}
                  type="button"
                  className="leyenda-control__boton"
                  aria-label={`Etapa ${APICE_STAGE_LABEL[status]}`}
                  aria-pressed={elegida}
                  onClick={() => onEtapa(elegida ? null : status)}
                >
                  <span className="leyenda-control__celda leyenda-control__etapa-superficie">
                    <CeldaSuperficie axes={['agua']} status={status} ancho={ANCHO_CELDA} grosor={elegida ? 4 : 2} />
                  </span>
                  <span
                    className={`leyenda-control__nombre leyenda-control__nombre--rotulo${elegida ? ' leyenda-control__nombre--elegido' : ''}`}
                    aria-hidden="true"
                  >
                    {APICE_STAGE_LABEL[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {onNivel !== undefined && (
          <div className="leyenda-control__grupo leyenda-control__grupo--nivel" role="group" aria-label="Nivel">
            <div className="c-seccion">
              <span className="c-rot">Nivel</span>
            </div>
            <div className="leyenda-control__fila leyenda-control__fila--nivel">
              {NIVELES.map((item) => {
                const activo = nivel === item.nivel;
                return (
                  <button
                    key={item.nivel}
                    type="button"
                    className="leyenda-control__boton leyenda-control__boton--nivel"
                    aria-label={item.nombre}
                    aria-pressed={activo}
                    onClick={() => onNivel(item.nivel)}
                  >
                    <Celda
                      ancho={item.ancho}
                      relleno={activo ? 'var(--text)' : 'none'}
                      contorno="var(--text)"
                      grosor={1.5}
                    />
                  </button>
                );
              })}
            </div>
            <div className="leyenda-control__extremos" aria-hidden="true">
              <span>Alejar</span>
              <span>Acercar</span>
            </div>
          </div>
        )}
      </div>

      {onQuitar !== undefined && hayFiltro && (
        <div className="leyenda-control__quitar">
          <button type="button" className="c-enlace" onClick={onQuitar}>
            Quitar filtros
          </button>
        </div>
      )}
    </div>
  );
}
