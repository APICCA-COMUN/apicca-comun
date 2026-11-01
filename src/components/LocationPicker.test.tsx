import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import type { Point } from '../../shared/domain/location';
import { expectBlocks } from '../testing/expectBlocks';
import { KEEP_LOCATION, type LocationDraft } from './locationDraft';
import { LocationPicker, type PointMapProps } from './LocationPicker';

type Props = Partial<ComponentProps<typeof LocationPicker>>;

/** Mapa de mentira: un botón que «marca» un punto fijo. */
function FakeMap({ point, onPick }: PointMapProps) {
  return (
    <div className="leaflet-container">
      <p>{point === null ? 'mapa sin punto' : `mapa en ${point.lat}, ${point.lng}`}</p>
      <button type="button" onClick={() => onPick({ lat: -33.4512345678, lng: -70.6612345678 })}>
        marcar
      </button>
    </div>
  );
}

function Harness({ initial = KEEP_LOCATION, ...props }: Props & { initial?: LocationDraft }) {
  const [draft, setDraft] = useState<LocationDraft>(initial);
  return (
    <>
      <LocationPicker stored={null} value={draft} onChange={setDraft} map={FakeMap} {...props} />
      <output aria-label="borrador">{JSON.stringify(draft)}</output>
    </>
  );
}

const draftOf = () => JSON.parse(screen.getByLabelText('borrador').textContent ?? '') as LocationDraft;
const stored = { lat: -33.455, lng: -70.665, precision: 'approximate' } as const;

describe('LocationPicker por coordenadas', () => {
  it('RF-9 (001): sin ubicación guardada dice «Sin ubicación» y ofrece latitud y longitud', () => {
    render(<Harness />);
    expect(screen.getByText('Sin ubicación')).toBeTruthy();
    expect(screen.getByLabelText('Latitud')).toBeTruthy();
    expect(screen.getByLabelText('Longitud')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quitar ubicación' })).toBeNull();
  });

  it('RF-9 (001): escribir latitud y longitud arma un borrador aproximado por defecto', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-33.45' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-70.66' } });
    expect(draftOf()).toEqual({ mode: 'set', lat: '-33.45', lng: '-70.66', precision: 'approximate' });
    expect((screen.getByRole('radio', { name: /Aproximada/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('RF-9 (001): muestra la zona que verán las demás personas con coordenadas válidas', () => {
    render(<Harness initial={{ mode: 'set', lat: '-33.4512', lng: '-70.6634', precision: 'approximate' }} />);
    expect(screen.getByText(/Se mostrará: Zona de ≈ 1 km alrededor de -33.455, -70.665/)).toBeTruthy();
  });

  it('RF-9 (001): con coordenadas inválidas avisa y no ofrece una vista previa', () => {
    render(<Harness initial={{ mode: 'set', lat: '120', lng: '0', precision: 'approximate' }} error="Revisa las coordenadas." />);
    expect(screen.getByRole('alert').textContent).toContain('Revisa las coordenadas.');
    expect(screen.queryByText(/Se mostrará/)).toBeNull();
  });

  it('RF-9 (001): con ubicación guardada, quitarla marca el borrador y se puede deshacer', async () => {
    render(<Harness stored={stored} />);
    expect(screen.getByText(/Zona de ≈ 1 km alrededor de -33.455, -70.665/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    expect(draftOf()).toEqual({ mode: 'remove' });
    expect(screen.getByText(/Se quitará la ubicación al guardar/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Conservar ubicación' }));
    expect(draftOf()).toEqual(KEEP_LOCATION);
  });

  it('RF-9 (001): quitar un borrador nuevo vuelve a conservar lo guardado', async () => {
    render(<Harness initial={{ mode: 'set', lat: '1', lng: '2', precision: 'approximate' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    expect(draftOf()).toEqual(KEEP_LOCATION);
  });

  it('RNF-2 (001): todo se maneja con campos y botones etiquetados, sin depender del mapa', () => {
    render(<Harness map={null} />);
    expect(screen.getByRole('group', { name: 'Ubicación' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Marcar en el mapa' })).toBeNull();
    expect(screen.getByLabelText('Latitud')).toBeTruthy();
  });
});

describe('LocationPicker por mapa y precisión', () => {
  it('RF-9 (001): marcar un punto en el mapa rellena las coordenadas', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    await userEvent.click(await screen.findByRole('button', { name: 'marcar' }));
    expect(draftOf()).toEqual({ mode: 'set', lat: '-33.451235', lng: '-70.661235', precision: 'approximate' });
    expect((screen.getByLabelText('Latitud') as HTMLInputElement).value).toBe('-33.451235');
  });

  it('RF-9 (001): elegir precisión exacta queda en el borrador', async () => {
    render(<Harness initial={{ mode: 'set', lat: '1', lng: '2', precision: 'approximate' }} />);
    await userEvent.click(screen.getByRole('radio', { name: /Exacta/ }));
    expect(draftOf()).toEqual({ mode: 'set', lat: '1', lng: '2', precision: 'exact' });
  });

  it('RF-9 (001): quien puede leer el punto cambia solo la precisión como borrador de precisión', async () => {
    const exact: Point = { lat: -33.4512, lng: -70.6634 };
    render(<Harness stored={stored} exact={exact} />);
    await userEvent.click(screen.getByRole('radio', { name: /Exacta/ }));
    expect(draftOf()).toEqual({ mode: 'precision', precision: 'exact' });
  });

  it('RF-9 (001): quien puede leer el punto lo ve, con la nota de que es privado', () => {
    render(<Harness stored={stored} exact={{ lat: -33.4512, lng: -70.6634 }} />);
    expect(screen.getByText(/Punto exacto: -33.4512, -70.6634/)).toBeTruthy();
    expect(screen.getByText(/solo la autoría y la facilitación/)).toBeTruthy();
  });

  it('RF-9 (001): quien no es autora ni facilitadora no ve el punto exacto pero sí cambia la precisión guardada', async () => {
    render(<Harness stored={stored} />);
    expect(screen.queryByText(/Punto exacto/)).toBeNull();
    expect(screen.queryByText(/-33.4512/)).toBeNull();
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLInputElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole('radio', { name: /Exacta/ }));
    expect(draftOf()).toEqual({ mode: 'precision', precision: 'exact' });
  });

  it('RF-9 (001): quien no lo puede leer sí puede reemplazar la ubicación con un punto nuevo', async () => {
    render(<Harness stored={stored} />);
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '6' } });
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLInputElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole('radio', { name: /Exacta/ }));
    expect(draftOf()).toEqual({ mode: 'set', lat: '5', lng: '6', precision: 'exact' });
  });

  it('RF-9 (001): una ubicación exacta guardada es la que ven todas las personas y puede cambiarse su precisión', () => {
    render(<Harness stored={{ lat: -33.4512, lng: -70.6634, precision: 'exact' }} />);
    expect(screen.getByText(/Punto exacto: -33.4512, -70.6634/)).toBeTruthy();
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLInputElement).disabled).toBe(false);
  });

  it('RNF-10 (001): si el mapa falla, el selector sigue funcionando por coordenadas', async () => {
    function Broken(): never {
      throw new Error('sin mapa');
    }
    const quiet = console.error;
    console.error = () => {};
    try {
      render(<Harness map={Broken} />);
      await userEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
      expect((await screen.findByRole('alert')).textContent).toContain('El mapa no cargó');
      expect(screen.getByLabelText('Latitud')).toBeTruthy();
    } finally {
      console.error = quiet;
    }
  });

  it('RF-6 (002) · 6.1, 6.3: campos y avisos son bloques, radios llevan «choice» y botones son acciones secundarias', () => {
    const { container } = render(<Harness initial={{ mode: 'set', lat: '-33.45', lng: '-70.66', precision: 'approximate' }} error="Coordenadas inválidas" />);
    expectBlocks(container);
    expect(screen.getByLabelText('Latitud').className).toBe('block');
    expect(screen.getByLabelText('Longitud').className).toBe('block');
    expect(screen.getByRole('alert').classList.contains('block')).toBe(true);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.classList.contains('choice')).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Quitar ubicación' }).className).toBe('block action-secondary');
    expect(screen.getByRole('button', { name: 'Marcar en el mapa' }).className).toBe('block action-secondary');
  });
});

