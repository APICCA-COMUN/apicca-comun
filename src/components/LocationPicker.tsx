// RF-9 (001), RNF-2 (001), RNF-10 (001) · Selector de ubicación del formulario: se maneja por coordenadas (sin
// necesidad del mapa), y el mapa, que se carga aparte, solo ayuda a marcar el punto. El punto exacto solo lo
// recibe quien es autora o facilitadora (`exact`); para las demás personas no existe en pantalla.
// RF-6 (002) · 6.1, 6.3: campos y avisos como bloques, radios con «choice» y botones como acciones secundarias.
// RF-1 (016), RNF-1 (016), D-T5 (016): sin `mayRaise` no se fija un punto ni se vuelve exacta; quitar y «Aproximada» siguen.
import { Component, lazy, Suspense, useId, useState, type ComponentType, type ReactNode } from 'react';
import { DEFAULT_PRECISION, displayLocation, validateCoordinates, type Location, type Point, type Precision } from '../../shared/domain/location';
import { KEEP_LOCATION, resolveLocationDraft, typeCoordinates, type LocationDraft } from './locationDraft';
import { describeLocation, formatDegrees } from './locationText';

/** Lo que el selector le pide a un mapa: pintar el punto actual y avisar dónde se hizo clic. */
export interface PointMapProps {
  point: Point | null;
  onPick: (point: Point) => void;
}

const LazyPointMap = lazy(() => import('../map/PointPickerMap'));

interface LocationPickerProps {
  /** Ubicación de pantalla guardada; `null` si el ápice no tiene. */
  stored: Location | null;
  /** Punto exacto guardado. Solo se pasa a la autora y a la facilitación; `undefined` = no se puede leer. */
  exact?: Point | undefined;
  value: LocationDraft;
  onChange: (draft: LocationDraft) => void;
  /** Mensaje de las coordenadas escritas que no son válidas. */
  error?: string | undefined;
  /** Mapa para marcar el punto; `null` lo quita y deja solo las coordenadas. */
  map?: ComponentType<PointMapProps> | null | undefined;
  /** Si puede fijar un punto o volver exacta la ubicación: solo la autora y la facilitación (RF-1 (016)). */
  mayRaise?: boolean | undefined;
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    console.error('El mapa del selector falló', error);
  }

  override render(): ReactNode {
    if (this.state.failed) return <p role="alert" className="block">El mapa no cargó. Puedes escribir las coordenadas.</p>;
    return this.props.children;
  }
}

const PRECISION_OPTIONS: { value: Precision; label: string }[] = [
  { value: 'approximate', label: 'Aproximada (zona de ≈ 1 km)' },
  { value: 'exact', label: 'Exacta (el punto marcado)' },
];

export function LocationPicker({ stored, exact, value, onChange, error, map = LazyPointMap, mayRaise = true }: LocationPickerProps) {
  const id = useId();
  const [mapOpen, setMapOpen] = useState(false);

  const exactKnown: Point | undefined = exact ?? (stored?.precision === 'exact' ? stored : undefined);
  const hasLocation = value.mode === 'set' || (value.mode !== 'remove' && stored !== null);
  const canChangePrecision = hasLocation;
  // Sin permiso, «Exacta» solo se puede conservar si ya lo era (RF-1 (016)).
  const blocksOption = (option: Precision): boolean => !mayRaise && option === 'exact' && stored?.precision !== 'exact';
  const precision: Precision | undefined =
    value.mode === 'set' || value.mode === 'precision' ? value.precision : stored?.precision;

  const typed = value.mode === 'set' ? resolveLocationDraft(value) : null;
  const typedPoint = typed?.ok && typed.value.mode === 'set' ? { lat: typed.value.lat, lng: typed.value.lng } : null;
  const preview = typedPoint && value.mode === 'set' ? displayLocation(typedPoint, value.precision) : null;

  const choosePrecision = (next: Precision): void => {
    if (value.mode === 'set') onChange({ ...value, precision: next });
    else onChange(next === stored?.precision ? KEEP_LOCATION : { mode: 'precision', precision: next });
  };

  const pick = (point: Point): void => {
    const checked = validateCoordinates(point.lat, point.lng);
    if (!checked.ok) return;
    onChange({
      mode: 'set',
      lat: formatDegrees(checked.value.lat),
      lng: formatDegrees(checked.value.lng),
      precision: value.mode === 'precision' || value.mode === 'set' ? value.precision : DEFAULT_PRECISION,
    });
  };

  const PointMap = map;
  return (
    <fieldset>
      <legend>Ubicación</legend>
      {value.mode === 'remove' ? (
        <p>Se quitará la ubicación al guardar.</p>
      ) : preview ? (
        <p>{`Se mostrará: ${describeLocation(preview)}`}</p>
      ) : (
        <p>{describeLocation(stored)}</p>
      )}
      {value.mode === 'precision' && <p>{`Al guardar, la precisión pasará a ${value.precision === 'exact' ? 'exacta' : 'aproximada'}.`}</p>}
      {exact !== undefined && stored?.precision === 'approximate' && value.mode !== 'remove' && (
        <p>{`Punto exacto: ${formatDegrees(exact.lat)}, ${formatDegrees(exact.lng)} (solo la autoría y la facilitación lo ven)`}</p>
      )}

      {!mayRaise && <p className="block">Solo la autoría y la facilitación pueden fijar la ubicación o volverla exacta.</p>}
      <div>
        <label htmlFor={`${id}-lat`}>Latitud</label>
        <input
          id={`${id}-lat`}
          type="text"
          className="block"
          inputMode="decimal"
          value={value.mode === 'set' ? value.lat : ''}
          aria-invalid={error !== undefined}
          disabled={!mayRaise}
          onChange={(event) => onChange(typeCoordinates(value, { lat: event.target.value }))}
        />
      </div>
      <div>
        <label htmlFor={`${id}-lng`}>Longitud</label>
        <input
          id={`${id}-lng`}
          type="text"
          className="block"
          inputMode="decimal"
          value={value.mode === 'set' ? value.lng : ''}
          aria-invalid={error !== undefined}
          disabled={!mayRaise}
          onChange={(event) => onChange(typeCoordinates(value, { lng: event.target.value }))}
        />
      </div>
      {error !== undefined && <p role="alert" className="block">{error}</p>}

      {hasLocation && (
        <div role="radiogroup" aria-label="Precisión">
          {PRECISION_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                className="choice"
                name={`${id}-precision`}
                checked={precision === option.value}
                disabled={!canChangePrecision || blocksOption(option.value)}
                onChange={() => choosePrecision(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}

      {value.mode === 'remove' ? (
        <button type="button" className="block action-secondary" onClick={() => onChange(KEEP_LOCATION)}>
          Conservar ubicación
        </button>
      ) : (
        (value.mode === 'set' || stored !== null) && (
          <button type="button" className="block action-secondary" onClick={() => onChange(stored !== null ? { mode: 'remove' } : KEEP_LOCATION)}>
            Quitar ubicación
          </button>
        )
      )}

      {PointMap !== null && (
        <>
          <button
            type="button"
            className="block action-secondary"
            aria-expanded={mapOpen}
            disabled={!mayRaise}
            onClick={() => setMapOpen(!mapOpen)}
          >
            Marcar en el mapa
          </button>
          {mapOpen && (
            <MapBoundary>
              <Suspense fallback={<p role="status" className="block">Cargando el mapa…</p>}>
                <PointMap point={typedPoint ?? exactKnown ?? stored} onPick={pick} />
              </Suspense>
            </MapBoundary>
          )}
        </>
      )}
    </fieldset>
  );
}
