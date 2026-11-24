// RF-4 (002) · 4.2, 4.3, 4.5: el glifo identifica el eje por su forma, sin depender del color.
// Sistema «APICCA · Mapa» (23-11-2026): el glifo de un eje (agua círculo, alimento trapecio, cobijo cuadrado,
// energía triángulo, comunicación barra diagonal). Con `tile`, sobre su losa de color y en `glifo-sobre-eje`;
// sin ella, suelto en `currentColor`. Las leyendas de Etapa y de ejes, y los siete íconos de interfaz, van aquí.
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { APICE_STAGE_LABEL, APICE_STATUSES } from '../../shared/domain/apice';
import { AXES } from '../../shared/domain/apice';
import { axisIdentity, glyph, RULE_BY_STATUS, type GlyphMode } from '../../shared/domain/identity';
import { Superficie } from './Superficie';
import './Superficie.css';

interface GlifoProps {
  axis: Axis;
  size?: number;
  mode?: GlyphMode;
  /** Sobre la losa del color del eje (por defecto) o suelto en `currentColor`. */
  tile?: boolean;
  /** Con nombre accesible (el nombre del eje, o `label`); si no, decorativo. */
  labelled?: boolean;
  label?: string;
  /** Proporción del semilado respecto del lado (0,29 en la losa, 0,33 suelto). */
  k?: number;
  x?: number | undefined;
  y?: number | undefined;
  className?: string;
}

export function Glifo({ axis, size = 24, mode = 'macizo', tile = true, labelled = false, label, k, x, y, className }: GlifoProps) {
  const { key } = axisIdentity(axis);
  const s = size * (k ?? (tile ? 0.29 : 0.33));
  const g = glyph(key, size / 2, size / 2, s, mode);
  const a11y = labelled ? { role: 'img', 'aria-label': label ?? axis } : { 'aria-hidden': true as const };
  return (
    <svg
      className={['glifo', tile && 'glifo--losa', `glifo--${key}`, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      x={x}
      y={y}
      focusable="false"
      {...a11y}
    >
      {/* QA #13.1: la losa lleva su contorno de 2 px (`--stroke-outline` en `--contorno-superficie`, en Superficie.css); el
          trazo se centra en el borde, así que el rectángulo se mete 1 px (la mitad del trazo) para que no lo recorte el SVG. */}
      {tile && <rect className="glifo__losa" x={1} y={1} width={size - 2} height={size - 2} />}
      {mode === 'macizo' ? (
        <path className="glifo__forma" d={g.d} />
      ) : (
        <>
          <path className="glifo__trazo" d={g.d} strokeWidth={g.strokeWidth} />
          {g.half && <path className="glifo__forma" d={g.half} />}
        </>
      )}
    </svg>
  );
}

/** Leyenda de Etapa: un mismo eje en las tres reglas, con el nombre de la Etapa debajo. */
export function LeyendaEtapa({ axis = 'agua', width = 116, height = 38, showRule = false }: { axis?: Axis; width?: number; height?: number; showRule?: boolean }) {
  return (
    <ul className="leyenda-etapa" aria-label="Etapas">
      {APICE_STATUSES.map((status: ApiceStatus) => (
        <li key={status} className="leyenda-etapa__item">
          <Superficie axes={[axis]} status={status} width={width} height={height} scale={0.42} decorative />
          <span className="rotulo">{APICE_STAGE_LABEL[status]}</span>
          {showRule && <span className="leyenda-etapa__regla">{RULE_BY_STATUS[status]}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Leyenda de ejes: losa con el glifo y el nombre del eje. */
export function LeyendaEjes({ axes = AXES, size = 22 }: { axes?: readonly Axis[]; size?: number }) {
  return (
    <ul className="leyenda-ejes" aria-label="Ejes">
      {axes.map((axis) => (
        <li key={axis} className="leyenda-ejes__item">
          <Glifo axis={axis} size={size} />
          {axis}
        </li>
      ))}
    </ul>
  );
}

export type IconoName = 'ofrece' | 'necesita' | 'avanzar' | 'tema' | 'cerrar' | 'agregar' | 'etapa';

/** Los siete íconos de interfaz del sistema, en `currentColor`, del mismo dibujo que los glifos. */
const ICONOS: Record<IconoName, { w: number; h: number; body: React.ReactNode }> = {
  ofrece: { w: 16, h: 14, body: <path d="M0 14L8 0L16 14z" className="icono__lleno" /> },
  necesita: { w: 16, h: 14, body: <path d="M1.7 1L8 12L14.3 1z" className="icono__trazo" strokeWidth={2.4} /> },
  avanzar: { w: 16, h: 18, body: <path d="M0 0L16 9L0 18z" className="icono__lleno" /> },
  tema: {
    w: 22,
    h: 22,
    body: (
      <>
        <circle cx="11" cy="11" r="9.5" className="icono__trazo" strokeWidth={3} />
        <path d="M11 1.5a9.5 9.5 0 0 1 0 19z" className="icono__lleno" />
      </>
    ),
  },
  cerrar: { w: 28, h: 28, body: <path d="M5 5L23 23M23 5L5 23" className="icono__trazo" strokeWidth={3.5} /> },
  agregar: { w: 28, h: 28, body: <path d="M14 4V24M4 14H24" className="icono__trazo" strokeWidth={3.5} /> },
  etapa: {
    w: 32,
    h: 32,
    body: (
      <>
        {[5.3, 16, 26.7].map((cx) => (
          <circle key={cx} cx={cx} cy="4" r="2" className="icono__lleno" />
        ))}
        {[4, 12, 20, 28].map((cx) => (
          <circle key={cx} cx={cx} cy="16" r="4" className="icono__lleno" />
        ))}
        <svg x="0" y="24" width="32" height="8" viewBox="0 24 32 8">
          <circle cx="16" cy="28" r="2.4" className="icono__lleno" />
          <circle cx="16" cy="28" r="6.5" className="icono__trazo" strokeWidth={2} />
          <circle cx="16" cy="28" r="11" className="icono__trazo" strokeWidth={2} />
        </svg>
      </>
    ),
  },
};

/** Un ícono de interfaz. Con `label`, tiene nombre accesible; si no, es decorativo. `size` fija el alto. */
export function Icono({ name, size, label }: { name: IconoName; size?: number; label?: string }) {
  const i = ICONOS[name];
  const k = (size ?? i.h) / i.h;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg className={`icono icono--${name}`} width={Number((i.w * k).toFixed(1))} height={Number((i.h * k).toFixed(1))} viewBox={`0 0 ${i.w} ${i.h}`} focusable="false" {...a11y}>
      {i.body}
    </svg>
  );
}
