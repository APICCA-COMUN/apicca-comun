// RF-7 (003) · 7.5, RF-4 (003) · 4.5 y RF-10 (002) · Conmutador de tema como botón de ícono (el disco mitad lleno del
// sistema «APICCA · Mapa», `Icono` «tema», el mismo en los dos temas): el nombre dice a qué tema cambia y el tema vigente
// va en texto solo para lectores, enlazado con `aria-describedby`, sin `aria-pressed` (D-T19 (002)). Es un bloque de
// ícono (RF-6 (002) · 6.3).
import { useId } from 'react';
import { useTheme } from '../app/useTheme';
import { Icono } from './Glifo';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const descriptionId = useId();

  const isLight = theme === 'light';
  const label = isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
  const currentText = isLight ? 'Tema actual: claro' : 'Tema actual: oscuro';

  return (
    <div className="theme-toggle">
      <button type="button" className="block icon-button" onClick={toggle} aria-label={label} aria-describedby={descriptionId}>
        <Icono name="tema" size={22} />
      </button>
      <span id={descriptionId} className="visually-hidden">
        {currentText}
      </span>
    </div>
  );
}
