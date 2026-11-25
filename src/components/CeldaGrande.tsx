// RF-15 (019) · 15.2 · «E3 · Celda» (24-11-2026, Propuesta del asistente): la ampliación del Ápice elegido. Una celda hexagonal grande con la
// superficie de patrón del Ápice (franjas por eje, regla por Etapa), recortada al hexágono y con contorno de 2 px: el mismo
// aspecto que la celda del mapa. Con `titulo` tiene nombre accesible («título, agua y cobijo, Etapa Prototipo»); sin él es decorativa.
import type { Axis, ApiceStatus } from '../../shared/domain/apice';
import { CeldaSuperficie } from './Celda';
import { superficieLabel } from './Superficie';

interface CeldaGrandeProps {
  axes: readonly Axis[];
  status: ApiceStatus;
  /** Ancho de vértice a vértice, en px (280 en el diseño). */
  ancho: number;
  /** El nombre del Ápice, para el nombre accesible. */
  titulo?: string;
}

export function CeldaGrande({ axes, status, ancho, titulo }: CeldaGrandeProps) {
  const list = axes.length > 0 ? axes : (['agua'] as const);
  const label = titulo === undefined ? undefined : `${titulo}, ${superficieLabel(list, status)}`;
  return <CeldaSuperficie axes={axes} status={status} ancho={ancho} className="celda-grande" {...(label === undefined ? {} : { label })} />;
}
