// RNF-10 (001) · Borradores en memoria: lo escrito en un editor sobrevive a que la sesión termine
// (RF-3 (001)). Nada va a disco ni al servidor; al cerrar la pestaña se pierde.
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

export interface Drafts {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  clear(key: string): void;
  clearAll(): void;
  /** Hay algún borrador con texto. */
  hasAny(): boolean;
  subscribe(listener: () => void): () => void;
}

export function createDrafts(): Drafts {
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: (key) => values.get(key),
    set(key, value) {
      values.set(key, value);
      notify();
    },
    clear(key) {
      values.delete(key);
      notify();
    },
    clearAll() {
      values.clear();
      notify();
    },
    hasAny: () => [...values.values()].some((value) => value !== ''),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Almacén de la app; las pruebas inyectan el suyo con `DraftsContext`. */
export const DraftsContext = createContext<Drafts>(createDrafts());

export function useDrafts(): Drafts {
  return useContext(DraftsContext);
}

/** Texto de un editor guardado como borrador: `[texto, cambiar]`. */
export function useDraft(key: string): [string, (value: string) => void] {
  const drafts = useDrafts();
  const text = useSyncExternalStore(drafts.subscribe, () => drafts.get(key) ?? '');
  const setText = useCallback((value: string) => drafts.set(key, value), [drafts, key]);
  return [text, setText];
}
