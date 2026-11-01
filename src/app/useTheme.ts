// El tema vigente y el conmutador (RF-3 (002) · 3.3, 3.4, D-22 (002), D-T7 (002)): sigue al sistema
// mientras nadie elija, la elección manda desde ahí y otra pestaña puede cambiarla o borrarla.
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveTheme } from '../../shared/domain/identity';
import { THEME_KEY, applyTheme, clearTheme, observeSystem, savedTheme, systemTheme, type Theme } from './theme';

/** La elección puesta en la página o guardada; en una ventana privada solo queda el atributo. */
const chosenTheme = (): unknown => document.documentElement.dataset['theme'] ?? savedTheme();

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(chosenTheme(), systemTheme()));
  const chosen = useRef(['light', 'dark'].includes(String(chosenTheme())));

  const toggle = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    chosen.current = true;
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  useEffect(() => {
    // Tras una elección, el aviso del sistema se ignora (D-22 (002)).
    const stopObserving = observeSystem((system) => {
      if (!chosen.current) setTheme(system);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        chosen.current = true;
        applyTheme(event.newValue);
        setTheme(event.newValue);
        return;
      }
      // Otra pestaña borró la clave o dejó un valor inválido: sin elección, manda el sistema.
      chosen.current = false;
      clearTheme();
      setTheme(systemTheme());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      stopObserving();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { theme, toggle };
}
