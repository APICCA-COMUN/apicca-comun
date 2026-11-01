// RF-6 (005) · 6.12, RF-7 (005) · 7.1, 7.8, 7.9, 7.11, 7.12, 7.13, RF-8 (005) · 8.2, 8.5, D-10 (005), D-T7 (005), D-T8 (005), D-T12 (005) · Lote ilustrado con su panel:
// lleva la selección, pide confirmar el descarte de cambios sin guardar con un aviso dentro de la página y avisa si la
// edición rápida está a la vista. Con `alwaysPanel`, el panel nunca se cierra:
// muestra el primer ápice si no hay elegido y, con la lista vacía, el lote vacío y un aviso (RF-6 (005) · 6.12, RF-7 (005) · 7.13).
// La ranura `toolbar` va sobre el borde inferior del lote; sin ápices y sin `alwaysPanel`, va suelta.
import { useEffect, useState, type ReactNode } from 'react';
import type { ApiOps, OpClient } from '../data/api';
import type { ApiceSource, ListedApice } from '../data/apices';
import { ApiceLot } from './ApiceLot';
import { ApiceQuickPanel, type QuickFields } from './ApiceQuickPanel';
import './ApiceLotSection.css';

interface Props {
  items: readonly ListedApice[];
  toolbar?: ReactNode;
  /** Prototipado: el panel siempre está a la vista, con el primer ápice si nadie eligió (RF-7 (005) · 7.12). */
  alwaysPanel?: boolean;
  layout?: 'grid' | 'trail';
  source?: ApiceSource;
  client?: OpClient<ApiOps>;
  onSaved(id: string, fields: QuickFields): void;
  onEditingChange?(editing: boolean): void;
}

export function ApiceLotSection({ items, toolbar, alwaysPanel = false, layout, source, client, onSaved, onEditingChange }: Props) {
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

  const empty = items.length === 0;
  const blank = empty && alwaysPanel;
  if (empty && toolbar === undefined && !blank) return null;

  // La barra conserva su lugar en el árbol al llegar los ápices, para no perder el foco ni el clic en curso.
  return (
    <div className={`apice-lot-section${alwaysPanel ? ' apice-lot-section--always' : ''}`}>
      <div className={empty && !blank ? undefined : 'apice-lot-section__stage'}>
        {blank && <div className="apice-lot-section__lot apice-lot-section__lot--empty" />}
        {!empty && (
          <div className="apice-lot-section__lot">
            <ApiceLot items={items} selectedId={selected?.id ?? null} onSelect={choose} {...(layout === undefined ? {} : { layout })} />
          </div>
        )}
        {toolbar !== undefined && (
          <div className={`apice-lot-section__toolbar${empty && !blank ? '' : ' apice-lot-section__toolbar--floating'}`}>{toolbar}</div>
        )}
      </div>
      {blank && (
        <div className="apice-lot-section__side">
          <aside className="block apice-panel" aria-label="Ápice elegido">
            <p>Aún no hay ápices para mostrar.</p>
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
