// El auxiliar `expectBlocks` (RF-6 (002) · 6.1, RF-2 (002) · 2.1, plan §0) y `blockNesting`
// (RF-3 (003) · 3.3, D-T4 (003), D-24 (003)): sus propias reglas.
import { beforeEach, describe, expect, it } from 'vitest';
import { blockNesting, blockProblems, expectBlocks } from './expectBlocks';

let container: HTMLDivElement;

const mount = (html: string) => {
  container.innerHTML = html;
  return container;
};

const CORRECT = `
  <form>
    <input class="block" aria-label="Nombre" />
    <input type="hidden" name="token" value="x" />
    <label><input type="checkbox" class="choice" /> Agua</label>
    <label><input type="radio" name="v" class="choice" /> Pública</label>
    <select class="block"><option>Agua</option></select>
    <textarea class="block"></textarea>
    <button type="submit" class="block action-primary">Guardar</button>
  </form>
  <div role="dialog" class="block"><p>¿Seguro?</p></div>
  <p role="alert" class="block">Error.</p>
  <p role="status" class="block">Listo.</p>
  <div class="leaflet-container"><a role="button" href="#">+</a><button>Acercar</button></div>
  <img style="width: 128px; height: 128px" alt="" />
`;

beforeEach(() => {
  container = document.createElement('div');
});

describe('expectBlocks', () => {
  it('RF-6 (002) · 6.1: pasa con un fragmento correcto, con un hidden sin clase y con lo de dentro del mapa', () => {
    expect(blockProblems(mount(CORRECT))).toEqual([]);
    expect(() => expectBlocks(container)).not.toThrow();
  });

  it('RF-6 (002) · 6.1: falla al quitar la clase de bloque de un botón', () => {
    mount(CORRECT.replace('class="block action-primary"', 'class="action-primary"'));
    expect(blockProblems(container)).toEqual(['sin «block»: <button type="submit" class="action-primary">']);
    expect(() => expectBlocks(container)).toThrow();
  });

  it('RF-6 (002) · 6.1: exige block en campos, diálogos y avisos, y choice en radios y casillas', () => {
    mount(`
      <input aria-label="Nombre" />
      <select></select>
      <textarea></textarea>
      <div role="dialog"></div>
      <p role="alert"></p>
      <p role="status"></p>
      <input type="checkbox" />
      <input type="radio" class="block" />
    `);
    const problems = blockProblems(container);
    expect(problems.filter((p) => p.startsWith('sin «block»'))).toHaveLength(6);
    expect(problems.filter((p) => p.startsWith('sin «choice»'))).toHaveLength(2);
  });

  it('RF-2 (002) · 2.1: falla si un atributo style lleva un color', () => {
    mount('<p style="color:red">Hola</p><span style="background-color: #fff">x</span><b style="border: 1px solid blue">y</b>');
    expect(blockProblems(container)).toEqual([
      'color en style: <p style="color:red">',
      'color en style: <span style="background-color: #fff">',
      'color en style: <b style="border: 1px solid blue">',
    ]);
  });

  it('RF-2 (002) · 2.1: un style sin color, como el lado calculado de un edificio, no falla', () => {
    mount('<div style="width: 128px; height: 128px; image-rendering: pixelated"></div>');
    expect(blockProblems(container)).toEqual([]);
  });
});

describe('blockNesting', () => {
  it('RF-3 (003) · 3.3: un bloque dentro de otro bloque falla', () => {
    mount('<section class="block"><div class="block"><p>Hola</p></div></section>');
    expect(blockNesting(container)).toEqual(['bloque anidado: <div class="block">']);
    expect(() => expectBlocks(container, { nesting: true })).toThrow();
  });

  it('RF-3 (003) · 3.3: un botón, un a.block o un .icon-button dentro de un bloque no falla (D-24 (003))', () => {
    mount(`
      <li class="block">
        <button class="block action-secondary">Restaurar</button>
        <a class="block action-primary" href="/x">Ir</a>
        <button class="block icon-button" aria-label="Cerrar">x</button>
      </li>`);
    expect(blockNesting(container)).toEqual([]);
    expect(() => expectBlocks(container, { nesting: true })).not.toThrow();
  });

  it('RF-3 (003) · 3.3: el edificio de un ápice dentro de una tarjeta o un lote no falla (D-28 (003))', () => {
    mount(`
      <article class="block"><div class="block building"><img alt="" /></div><h3>Huerta</h3></article>
      <section class="lot"><div class="block building"></div></section>`);
    expect(blockNesting(container)).toEqual([]);
    // El edificio no es contenedor: un bloque dentro de él sí falla.
    mount('<div class="block building"><div class="block">x</div></div>');
    expect(blockNesting(container)).toEqual(['bloque anidado: <div class="block">']);
  });

  it('RF-3 (003) · 3.3: los campos y demás controles no cuentan como contenedor', () => {
    mount(`
      <button class="block"><span class="block">a</span></button>
      <input class="block" aria-label="Nombre" />
      <select class="block"><option>Agua</option></select>
      <textarea class="block"></textarea>`);
    expect(blockNesting(container)).toEqual([]);
  });

  it('RF-3 (003) · 3.3: un campo de un formulario dentro de un tablero o un diálogo no es un anidamiento', () => {
    mount(`
      <form class="block"><label>Correo <input class="block" /></label><select class="block"></select><textarea class="block"></textarea></form>
      <div role="dialog" class="block"><input class="block" aria-label="Contraseña" /></div>`);
    expect(blockNesting(container)).toEqual([]);
  });

  it('RF-3 (003) · 3.3: un aviso sin block dentro de un bloque pasa, y con block falla', () => {
    mount('<div class="block"><p role="alert">Error.</p><p role="status">Listo.</p></div>');
    expect(blockNesting(container)).toEqual([]);
    expect(() => expectBlocks(container, { nesting: true })).not.toThrow();
    mount('<div class="block"><p role="alert" class="block">Error.</p></div>');
    expect(blockNesting(container)).toEqual(['bloque anidado: <p role="alert" class="block">']);
  });

  it('RF-3 (003) · 3.3: un aviso suelto sin block falla', () => {
    mount('<p role="alert">Error.</p>');
    expect(() => expectBlocks(container, { nesting: true })).toThrow();
    expect(() => expectBlocks(container)).toThrow();
  });

  it('RF-3 (003) · 3.3: sin la opción nesting, expectBlocks no aplica el anidamiento (lo activa T-2.3)', () => {
    mount('<section class="block"><div class="block"></div></section>');
    expect(() => expectBlocks(container)).not.toThrow();
  });
});
