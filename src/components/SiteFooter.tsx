// RF-8 (003) · 8.1, D-T8 (003), RF-5 (008) · 5.1–5.2, RF-1 (015), RF-2 (015), RF-4 (015), D-T3 (015): pie único del
// sitio (`contentinfo`) sobre `footer-bg`, en toda ruta y fuera de `<main>`. Muestra solo «Apoyado por» y el logo
// oficial de MangleRojo sin lema, enlazado a su sitio. Es un enlace externo, así que no usa `Link`.
import './SiteFooter.css';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__support">
          <span className="site-footer__support-text">Apoyado por</span>
          <a className="site-footer__support-link" href="https://manglerojo.org" target="_blank" rel="noopener noreferrer">
            <img src="/brand/manglerojo-sin-lema-negativo.svg" alt="MangleRojo ORG" width="107" height="28" />
          </a>
        </p>
      </div>
    </footer>
  );
}
