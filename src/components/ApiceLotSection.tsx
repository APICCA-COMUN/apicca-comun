// RF-7 (005) · 7.1, 7.8, 7.9, 7.11, 7.12, RF-8 (005) · 8.5, D-10 (005), D-T7 (005), D-T8 (005), D-T12 (005) · Lote ilustrado con su panel:
// lleva la selección, pide confirmar el descarte de cambios sin guardar con un aviso dentro de la página y avisa si la
// edición rápida está a la vista. Con `alwaysPanel`, el panel nunca se cierra y muestra el primer ápice si no hay elegido.
// El lote es la retícula, sin caminos (RF-8 (019) · 8.1, D-T5 (019)); con `layout="trail"`, el recorrido en zigzag de
// Prototipado (RF-8 (019) · 8.3, D-T26 (019)).
// RF-7 (019) · 7.1, 7.2, 7.3, D-T20 (019): los filtros ya no flotan sobre el lote (van en la franja de `TerrainStrip`); el
// panel va al lado desde 900 px y debajo en menos; mientras carga, el panel dice «Cargando ápices…». Sin ápices no se
// pinta: el vacío lo nombra la página (RF-19 (019), D-T22 (019)).
import { useEffect, useState } from 'react';
import type { ApiOps, OpClient } from '../data/api';
import type { ApiceSource, ListedApice } from '../data/apices';
import { ApiceLot } from './ApiceLot';
import { ApiceQuickPanel, type QuickFields } from './ApiceQuickPanel';
import './ApiceLotSection.css';

interface Props {
  items: readonly ListedApice[];
  /** Los ápices aún no llegan (RF-7 (019) · 7.3). */
  loading?: boolean;
  /** Prototipado: el panel siempre está a la vista, con el primer ápice si nadie eligió (RF-7 (005) · 7.12). */
  alwaysPanel?: boolean;
  /** Prototipado: el recorrido en zigzag (RF-8 (019) · 8.3). */
  layout?: 'grid' | 'trail';
  source?: ApiceSource;
  client?: OpClient<ApiOps>;
  onSaved(id: string, fields: QuickFields): void;
  onEditingChange?(editing: boolean): void;
}

export function ApiceLotSection({ items, loading = false, alwaysPanel = false, layout = 'grid', source, client, onSaved, onEditingChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const chosen = items.find((apice) => apice.id === selectedId) ?? null;
  const selected = chosen ?? (alwaysPanel ? (items[0] ?? null) : null);

  // El elegido salió de la lista (filtros): se cierra el panel, o pasa al primero si siempre está a la vista.
  useEffect(() => {
    if (selectedId !== null && chosen === null) {
      setSelectedId(null);
      setPending(null);
      setDirty(false);
    }
  }, [selectedId, chosen]);

  const choose = (id: string): void => {
    if (id === selected?.id) return;
    if (dirty) {
      setPending(id);
      return;
    }
    setSelectedId(id);
  };

  if (items.length === 0 && !(loading && alwaysPanel)) return null;

  return (
    <div className={`apice-lot-section${alwaysPanel ? ' apice-lot-section--always' : ''}`}>
      {items.length > 0 && (
        <div className="apice-lot-section__stage">
          <div className="apice-lot-section__lot">
            <ApiceLot items={items} selectedId={selected?.id ?? null} onSelect={choose} layout={layout} />
          </div>
        </div>
      )}
      {items.length === 0 && (
        <div className="apice-lot-section__side">
          <aside className="block apice-panel" aria-label="Ápice elegido">
            <p>Cargando ápices…</p>
          </aside>
        </div>
      )}
      {selected !== null && (
        <div className="apice-lot-section__side">
          {pending !== null && (
            <div role="alert" className="block apice-lot-section__discard">
              <p>Tienes cambios sin guardar en este ápice. ¿Quieres descartarlos?</p>
              <button
                type="button"
                className="block action-secondary"
                onClick={() => {
                  setSelectedId(pending);
                  setPending(null);
                  setDirty(false);
                }}
              >
                Descartar cambios
              </button>
              <button type="button" className="block action-secondary" onClick={() => setPending(null)}>
                Seguir editando
              </button>
            </div>
          )}
          <ApiceQuickPanel
            key={selected.id}
            apice={selected}
            {...(source === undefined ? {} : { source })}
            {...(client === undefined ? {} : { client })}
            onSaved={onSaved}
            onDirtyChange={setDirty}
            {...(onEditingChange === undefined ? {} : { onEditingChange })}
          />
        </div>
      )}
    </div>
  );
}
