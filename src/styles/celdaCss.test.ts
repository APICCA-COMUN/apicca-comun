// «E3 · Celda» (24-11-2026): reglas de CSS que ninguna prueba de jsdom puede ver (no calcula estilos). Se leen del texto de las
// hojas: la barra discreta de la columna, las muestras de Etapa en el tema oscuro y el rótulo de `.c-dato`.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(src, file), 'utf-8');
/** El cuerpo de la primera regla cuyo selector es exactamente `selector`. */
const rule = (css: string, selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('«E3 · Celda» · CSS', () => {
  it('la columna con desplazamiento lleva una barra delgada, del color de la trama y sin hex', () => {
    const panel = rule(read('pages/Play.css'), '.play__panel');
    expect(panel).toContain('scrollbar-width: thin;');
    expect(panel).toContain('scrollbar-color: var(--trama) transparent;');
    expect(panel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('en Inicio la lista de Ápices toma el espacio que sobra y se recorta, sin desplazamiento propio', () => {
    const css = read('pages/Play.css');
    expect(rule(css, '.play__home--base .play__rows-list')).toMatch(/overflow: hidden;/);
    expect(rule(css, '.play__home--base')).toContain('block-size: 100%;');
  });

  it('las muestras de Etapa llevan el glifo en la tinta del tema, no en la tinta fija que va sobre el color del eje', () => {
    const muestra = rule(read('components/LeyendaControl.css'), '.leyenda-control__etapa-superficie');
    expect(muestra).toContain('--axis-agua-fill: var(--background);');
    expect(muestra).toContain('--glifo-sobre-eje: var(--text);');
  });

  it('el rótulo de `.c-dato` cabe «Ubicación» y los rótulos largos pasan a columna', () => {
    const css = read('styles/piezas.css');
    const rotulo = rule(css, '.c-dato > .c-rot');
    // 7 em = 98 px con el rótulo de 14 px; «Ubicación» mide 92,5 px con su espaciado de letras.
    expect(rotulo).toContain('inline-size: 7em;');
    expect(css).toContain('.c-dato.c-dato--columna {');
    expect(read('pages/ApiceView.tsx')).toMatch(/c-dato c-dato--columna[\s\S]{0,80}Acción Común/);
  });
  it('QA celda 1 · 16: en la vista de lista, un filete de trama separa la lista de la leyenda fija', () => {
    expect(rule(read('pages/Play.css'), '.play__legend--lista')).toContain('border-block-start: var(--stroke-divider) solid var(--trama);');
    expect(read('pages/Play.tsx')).toContain("play__legend--lista");
  });

  it('QA celda 1 · 2: la leyenda separa sus filas (row-gap en los ejes) y sus grupos con 24 px', () => {
    const css = read('components/LeyendaControl.css');
    expect(rule(css, '.leyenda-control__grupos')).toContain('gap: 24px;');
    expect(rule(css, '.leyenda-control__fila--ejes')).toContain('row-gap: 12px;');
    expect(rule(css, '.leyenda-control__boton')).toContain('block-size: auto;');
  });

  it('QA celda 1 · 3: la lista de Inicio deja 6 px a cada lado para que el foco no se recorte', () => {
    const css = read('pages/Play.css');
    const start = css.indexOf('\n.play__rows-list {');
    expect(start).toBeGreaterThanOrEqual(0);
    const lista = css.slice(start, css.indexOf('}', start));
    expect(lista).toContain('padding: 6px;');
    expect(lista).toContain('margin-inline: -6px;');
  });

  it('QA celda 1 · 12: radios y casillas no usan el dibujo nativo, tienen radio 0 y una marca maciza, sin sombras ni degradados', () => {
    const css = read('styles/blocks.css');
    const base = rule(css, "input:is([type='radio'], [type='checkbox'])");
    expect(base).toContain('appearance: none;');
    expect(base).toContain('border-radius: 0;');
    expect(base).toContain('border: var(--stroke-outline) solid var(--text);');
    expect(rule(css, "input:is([type='radio'], [type='checkbox']):checked")).toContain('background-color: var(--text);');
    expect(base).not.toMatch(/gradient|shadow|accent-color/);
  });

  it('QA celda 1 · 7: los enlaces del índice de la documentación miden 44 px como mínimo', () => {
    expect(rule(read('pages/Documentation.css'), '.documentation__index a')).toContain('min-block-size: var(--size-icon-control);');
  });

  it('QA celda 1 · 7: las zonas tocables se agrandan con pseudo-elementos, sin tocar el dibujo del logo', () => {
    for (const [file, selector] of [
      ['components/SiteHeader.css', '.site-nav__link.menu-link::before'],
      ['components/Logo.css', '.logo::before'],
      ['pages/Forum.css', '.forum__summary a::after'],
      ['components/NoticeBell.css', '.notice-panel__item a::after'],
      ['styles/blocks.css', 'a.action-secondary:not(.block)::before'],
      ['map/GameMap.css', 'button.block.game-map__path-label::before'],
    ] as const) {
      expect(rule(read(file), selector), `${file} ${selector}`).toMatch(/position: absolute;/);
    }
  });
});
