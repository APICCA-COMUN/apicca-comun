// Los auxiliares `expectActions` (RF-4 (003) · 4.2, 4.7; D-T5 (003)): cuentan los botones azules visibles.
import { beforeEach, describe, expect, it } from 'vitest';
import { expectOnePrimary, primaryActions } from './expectActions';

let container: HTMLDivElement;

const mount = (html: string) => {
  container.innerHTML = html;
  return container;
};

beforeEach(() => {
  container = document.createElement('div');
});

describe('primaryActions', () => {
  it('RF-4 (003) · 4.2: devuelve los .action-primary y no los demás botones', () => {
    mount(`
      <button class="block action-primary">Guardar</button>
      <button class="block action-secondary">Cancelar</button>
      <a class="block action-primary" href="/x">Ir</a>`);
    expect(primaryActions(container).map((e) => e.textContent)).toEqual(['Guardar', 'Ir']);
  });

  it('RF-4 (003) · 4.2: omite los ocultos (hidden, aria-hidden)', () => {
    mount(`
      <button class="block action-primary" hidden>A</button>
      <div aria-hidden="true"><button class="block action-primary">B</button></div>
      <button class="block action-primary">C</button>`);
    expect(primaryActions(container).map((e) => e.textContent)).toEqual(['C']);
  });

  it('RF-4 (003) · 4.7: con un diálogo abierto solo cuenta los de dentro', () => {
    mount(`
      <form><button class="block action-primary">Guardar</button></form>
      <div role="dialog" class="block">
        <button class="block action-primary">Entrar</button>
        <button class="block action-secondary">Descartar y salir</button>
      </div>`);
    expect(primaryActions(container).map((e) => e.textContent)).toEqual(['Entrar']);
  });

  it('RF-4 (003) · 4.7: un diálogo oculto no cuenta como abierto', () => {
    mount(`
      <button class="block action-primary">Guardar</button>
      <div role="dialog" hidden><button class="block action-primary">Entrar</button></div>`);
    expect(primaryActions(container).map((e) => e.textContent)).toEqual(['Guardar']);
  });
});

describe('expectOnePrimary', () => {
  it('RF-4 (003) · 4.2: pasa con exactamente un botón azul del nombre esperado', () => {
    mount('<button class="block action-primary">Guardar</button><button class="block action-secondary">Otro</button>');
    expect(() => expectOnePrimary(container, 'Guardar')).not.toThrow();
  });

  it('RF-4 (003) · 4.2: con null pasa sin botón azul y falla si hay alguno', () => {
    mount('<button class="block action-secondary">Otro</button>');
    expect(() => expectOnePrimary(container, null)).not.toThrow();
    mount('<button class="block action-primary">Guardar</button>');
    expect(() => expectOnePrimary(container, null)).toThrow(/Guardar/);
  });

  it('RF-4 (003) · 4.2: falla listando los botones azules cuando hay más de uno', () => {
    mount('<button class="block action-primary">Guardar</button><button class="block action-primary" aria-label="Enviar ya">x</button>');
    expect(() => expectOnePrimary(container, 'Guardar')).toThrow(/Guardar[\s\S]*Enviar ya/);
  });

  it('RF-4 (003) · 4.2: falla echando en falta el esperado si no hay azul o el nombre no coincide', () => {
    mount('<button class="block action-secondary">Guardar</button>');
    expect(() => expectOnePrimary(container, 'Guardar')).toThrow(/Guardar/);
    mount('<button class="block action-primary">Otro</button>');
    expect(() => expectOnePrimary(container, 'Guardar')).toThrow(/Guardar/);
  });

  it('RF-4 (003) · 4.7: con un diálogo abierto, la única azul es la del diálogo', () => {
    mount(`
      <button class="block action-primary">Guardar</button>
      <div role="dialog"><button class="block action-primary">Entrar</button></div>`);
    expect(() => expectOnePrimary(container, 'Entrar')).not.toThrow();
    expect(() => expectOnePrimary(container, 'Guardar')).toThrow();
  });
});
