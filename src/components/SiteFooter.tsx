// RF-8 (003) · 8.1, D-T8 (003), RF-5 (008) · 5.1–5.2, RF-1 (015), RF-2 (015), RF-4 (015), D-T3 (015): pie único de las
// páginas de texto (`contentinfo`) sobre `footer-bg`, fuera de `<main>`. Muestra solo el apoyo (`SupportCredit`). Las
// páginas del mapa no lo pintan: el apoyo va en el menú de juego (RF-13 (021) · 13.5, D-T24 (021)).
import { SupportCredit } from './SupportCredit';
import './SiteFooter.css';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <SupportCredit prefix="site-footer" />
      </div>
    </footer>
  );
}
