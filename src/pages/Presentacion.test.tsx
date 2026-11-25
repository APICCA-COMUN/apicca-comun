// Presentación previa al lanzamiento (25-11-2026): la página de «/» para quien llega sin sesión. Se comprueba su h1, sus
// enlaces, que el campo es decorativo, que la leyenda de ejes funciona con el puntero y con el teclado, el texto vivo, que
// no usa el vocabulario que APICCA no usa ni emojis, y que sus estilos no llevan colores escritos a mano.
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { SessionProvider } from '../app/session';
import { Presentacion, estadoDelCampo } from './Presentacion';
import { apicesConEje, campoPresentacion } from './presentacionCampo';

afterEach(() => window.history.replaceState(null, '', '/'));

function mostrar() {
  render(
    <SessionProvider>
      <Presentacion />
    </SessionProvider>,
  );
}

const campoSvg = () => document.querySelector('svg.presentacion__mapa') as SVGSVGElement;
const leyenda = () => screen.getByRole('group', { name: 'Ejes de la muestra' });
const boton = (nombre: string) => within(leyenda()).getByRole('button', { name: nombre });
const apices = () => [...document.querySelectorAll('g.presentacion__apice')];
const apagados = () => document.querySelectorAll('g.presentacion__apice[data-off="true"]');
const estado = () => document.querySelector('.presentacion__estado') as HTMLElement;

describe('Presentación · estructura', () => {
  it('tiene un solo h1 con el nombre accesible completo', () => {
    mostrar();
    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'API para Crear y Conectar Acciones Comunes' })).toBe(titulos[0]);
  });

  it('la página no escribe <main> ni role="main": el único main lo pinta App.tsx (RF-3 (020) · 3.1)', () => {
    mostrar();
    expect(document.querySelector('main, [role="main"]')).toBeNull();
    expect(screen.queryByRole('main')).toBeNull();
    // Sin comentarios: la cabecera del archivo puede nombrar `<main>` en el texto (como en tests/tooling/un-solo-main.test.ts).
    const fuente = readFileSync('src/pages/Presentacion.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    expect(fuente).not.toMatch(/<main\b/);
    expect(fuente).not.toMatch(/role=["']main["']/);
  });

  it('el dibujo del título está oculto a los lectores de pantalla', () => {
    mostrar();
    const h1 = screen.getByRole('heading', { level: 1 });
    const dibujo = h1.querySelector('[aria-hidden="true"]');
    expect(dibujo).not.toBeNull();
    expect(dibujo!.textContent).toContain('API');
  });

  it('los enlaces llevan a solicitar, a la documentación y a entrar', () => {
    mostrar();
    const destinos = (nombre: string | RegExp) => screen.getAllByRole('link', { name: nombre }).map((enlace) => enlace.getAttribute('href'));
    expect(destinos('Solicitar inscripción')).toEqual(['/solicitar', '/solicitar']);
    expect(destinos('Qué es APICCA')).toEqual(['/documentacion/que-es-apicca']);
    expect(destinos('entra')).toEqual(['/entrar']);
    expect(destinos('Ya tengo cuenta')).toEqual(['/entrar']);
  });

  it('el campo de muestra es decorativo: aria-hidden y sin foco', () => {
    mostrar();
    expect((campoSvg())?.getAttribute('aria-hidden')).toBe('true');
    expect((campoSvg())?.getAttribute('focusable')).toBe('false');
    expect(campoSvg().querySelector('a, button, [tabindex], title')).toBeNull();
  });

  it('pinta los 20 Ápices y el Arco de muestra al empezar, sin ninguno apagado', () => {
    mostrar();
    expect(apices()).toHaveLength(20);
    expect(apagados()).toHaveLength(0);
    expect((document.querySelector('g.presentacion__arco'))?.getAttribute('data-inicial')).toBe('true');
    expect(document.querySelectorAll('path.presentacion__arco-trazo').length).toBeGreaterThan(0);
  });

  it('la leyenda tiene cinco botones, uno por eje, todos sueltos al empezar', () => {
    mostrar();
    const botones = within(leyenda()).getAllByRole('button');
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual(['Agua', 'Alimento', 'Cobijo', 'Energía', 'Comunicación']);
    for (const b of botones) expect((b)?.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Presentación · leyenda de ejes', () => {
  it('al tocar «Cobijo» queda presionado solo ese, apaga los Ápices sin cobijo y cambia el texto vivo', async () => {
    mostrar();
    const user = userEvent.setup();
    const antes = estado().textContent;
    await user.click(boton('Cobijo'));
    expect((boton('Cobijo'))?.getAttribute('aria-pressed')).toBe('true');
    for (const otro of ['Agua', 'Alimento', 'Energía', 'Comunicación']) expect((boton(otro))?.getAttribute('aria-pressed')).toBe('false');
    const campo = campoPresentacion();
    expect(apagados()).toHaveLength(campo.apices.length - apicesConEje(campo, 'cobijo').length);
    const encendidos = apices().filter((g) => g.getAttribute('data-off') !== 'true').length;
    expect(encendidos).toBe(apicesConEje(campo, 'cobijo').length);
    expect(estado().textContent).not.toBe(antes);
    expect(estado().textContent).toBe(estadoDelCampo(campo, 'cobijo'));
    expect(document.querySelector('g.presentacion__arco')?.hasAttribute('data-inicial')).toBe(false);
    expect((estado())?.getAttribute('aria-live')).toBe('polite');
  });

  it('al tocar el mismo eje otra vez lo suelta y vuelve la muestra', async () => {
    mostrar();
    const user = userEvent.setup();
    const inicial = estado().textContent;
    await user.click(boton('Cobijo'));
    await user.click(boton('Cobijo'));
    expect((boton('Cobijo'))?.getAttribute('aria-pressed')).toBe('false');
    expect(apagados()).toHaveLength(0);
    expect(estado().textContent).toBe(inicial);
    expect((document.querySelector('g.presentacion__arco'))?.getAttribute('data-inicial')).toBe('true');
  });

  it('elegir otro eje suelta el anterior: uno a la vez', async () => {
    mostrar();
    const user = userEvent.setup();
    await user.click(boton('Agua'));
    await user.click(boton('Energía'));
    expect((boton('Agua'))?.getAttribute('aria-pressed')).toBe('false');
    expect((boton('Energía'))?.getAttribute('aria-pressed')).toBe('true');
    expect(within(leyenda()).getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it.each([['Enter'], [' ']])('con teclado (Tab y %j) elige y suelta un eje', async (tecla) => {
    mostrar();
    const user = userEvent.setup();
    // Con el foco en la leyenda, el primer botón es «Agua»; se avanza hasta «Cobijo» (tercero).
    boton('Agua').focus();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(boton('Cobijo'));
    await user.keyboard(tecla === ' ' ? ' ' : '{Enter}');
    expect((boton('Cobijo'))?.getAttribute('aria-pressed')).toBe('true');
    expect(apagados().length).toBeGreaterThan(0);
    await user.keyboard(tecla === ' ' ? ' ' : '{Enter}');
    expect((boton('Cobijo'))?.getAttribute('aria-pressed')).toBe('false');
    expect(apagados()).toHaveLength(0);
  });

  it('cada eje, al elegirlo, apaga exactamente los Ápices que no lo tienen', async () => {
    mostrar();
    const user = userEvent.setup();
    const campo = campoPresentacion();
    for (const eje of AXES) {
      await user.click(boton(eje[0]!.toUpperCase() + eje.slice(1)));
      expect(apagados(), eje).toHaveLength(campo.apices.length - apicesConEje(campo, eje).length);
    }
  });
});

describe('estadoDelCampo', () => {
  const campo = campoPresentacion();

  it('sin eje describe la Acción Común de muestra', () => {
    expect(estadoDelCampo(campo, null)).toBe(`Acción Común de muestra: un arco une ${campo.arcoInicial.length} Ápices de ejes distintos.`);
  });

  it('con un eje dice cuántos Ápices se encienden', () => {
    const n = apicesConEje(campo, 'cobijo').length;
    expect(estadoDelCampo(campo, 'cobijo')).toBe(`Cobijo: se encienden ${n} Ápices y un arco los une.`);
    expect(estadoDelCampo(campo, 'comunicación')).toMatch(/^Comunicación: se encienden \d+ Ápices y un arco los une\.$/);
  });

  it('cada eje da un texto distinto', () => {
    const textos = new Set([null, ...AXES].map((eje) => estadoDelCampo(campo, eje)));
    expect(textos.size).toBe(6);
  });
});

describe('Presentación · lenguaje y estilos', () => {
  it('ningún texto visible usa el vocabulario que APICCA no usa', async () => {
    mostrar();
    const user = userEvent.setup();
    await user.click(boton('Cobijo'));
    const texto = (document.body.textContent ?? '').toLowerCase();
    for (const palabra of ['jugar', 'juego', 'plaza', 'edificio', 'manzana', 'camino', 'puntos', 'monedas', 'precio']) {
      expect(texto, palabra).not.toMatch(new RegExp(`(^|[^\\p{L}])${palabra}`, 'u'));
    }
  });

  it('no hay emojis en el texto visible ni en los nombres accesibles', () => {
    mostrar();
    const todo = [document.body.textContent ?? '', ...[...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? '')].join(' ');
    expect(todo).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it.each(['src/pages/Presentacion.tsx', 'src/pages/Presentacion.css', 'src/pages/presentacionCampo.ts'])('%s no lleva valores hex', (ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    expect(fuente.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
