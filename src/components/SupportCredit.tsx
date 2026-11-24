// RF-1 (015), RF-2 (015), RF-13 (021) · 13.5, D-T24 (021): «Apoyado por» y el logo oficial de MangleRojo sin lema,
// enlazado a su sitio. Lo usan el pie de las páginas de texto y el menú de la cabecera; `prefix` conserva las clases de cada
// lugar (`site-footer__support…`, `game-menu__support…`). Es un enlace externo, así que no usa `Link`.

export function SupportCredit({ prefix }: { prefix: string }) {
  return (
    <p className={`${prefix}__support`}>
      <span className={`${prefix}__support-text`}>Apoyado por</span>
      <a className={`${prefix}__support-link`} href="https://manglerojo.org" target="_blank" rel="noopener noreferrer">
        <img src="/brand/manglerojo-sin-lema-negativo.svg" alt="MangleRojo ORG" width="107" height="28" />
      </a>
    </p>
  );
}
