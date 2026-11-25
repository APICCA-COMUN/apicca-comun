// Presentación previa al lanzamiento (25-11-2026): la compuerta de `App`. Quien llega sin sesión a una página del mapa ve la
// presentación en «/»; con cuenta se ve el mapa como siempre; mientras la sesión carga no se pinta ni lo uno ni lo otro; las
// páginas de texto no cambian. El interruptor es `presentacionActiva()`: `VITE_PRESENTACION` ('1' enciende, '0' apaga) o,
// sin ella, `HASTA_EL_LANZAMIENTO` en el modo `production`.
import './testing/appDoubles';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { HASTA_EL_LANZAMIENTO, presentacionActiva } from './app/presentacion';
import { SessionProvider, type SessionState } from './app/session';

const VISITANTE: SessionState = { status: 'visitor' };
const PERSONA: SessionState = { status: 'person', uid: 'ana', role: 'member', username: 'ana' };
const SUSPENDIDA: SessionState = { status: 'suspended', uid: 'ana' };
const CARGANDO: SessionState = { status: 'loading' };

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

function mostrar(ruta: string, sesion: SessionState) {
  window.history.replaceState(null, '', ruta);
  render(
    <SessionProvider initial={sesion}>
      <App />
    </SessionProvider>,
  );
}

const h1Presentacion = () => screen.queryByRole('heading', { level: 1, name: 'API para Crear y Conectar Acciones Comunes' });
const hayMapa = () => document.querySelector('main.main--play') !== null;
const ruta = () => window.location.pathname + window.location.search;

describe('presentacionActiva', () => {
  it('con VITE_PRESENTACION=1 está encendida y con 0, apagada, en cualquier modo', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    expect(presentacionActiva()).toBe(true);
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_PRESENTACION', '0');
    expect(presentacionActiva()).toBe(false);
  });

  it('sin la variable, en el modo de prueba queda apagada', () => {
    vi.stubEnv('VITE_PRESENTACION', '');
    expect(presentacionActiva()).toBe(false);
  });

  it('sin la variable, en el modo production se enciende mientras dure HASTA_EL_LANZAMIENTO', () => {
    vi.stubEnv('VITE_PRESENTACION', '');
    vi.stubEnv('MODE', 'production');
    expect(HASTA_EL_LANZAMIENTO).toBe(true);
    expect(presentacionActiva()).toBe(true);
  });
});

describe('compuerta de la presentación · encendida', () => {
  it('la composición es la cabecera de la presentación, un solo main nativo con el h1 dentro y el pie del sitio', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar('/', VISITANTE);
    const principales = document.querySelectorAll('main');
    expect(principales).toHaveLength(1);
    const principal = principales[0]!;
    expect(principal.className).toBe('presentacion');
    expect(document.querySelectorAll('[role="main"]')).toHaveLength(0);
    expect(principal.contains(h1Presentacion())).toBe(true);
    const cabecera = document.querySelector('header.presentacion__cabecera')!;
    const pie = document.querySelector('footer')!;
    expect(cabecera).not.toBeNull();
    expect(pie).not.toBeNull();
    expect(principal.contains(cabecera)).toBe(false);
    expect(principal.contains(pie)).toBe(false);
    expect(cabecera.compareDocumentPosition(principal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(principal.compareDocumentPosition(pie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('header.site-header')).toHaveLength(1);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
    expect(principal.getAttribute('aria-busy')).toBeNull();
  });

  it('un visitante en «/» ve la presentación y no el mapa', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar('/', VISITANTE);
    expect(h1Presentacion()).not.toBeNull();
    expect(hayMapa()).toBe(false);
    expect(ruta()).toBe('/');
  });

  it.each(['/apices/x', '/acciones', '/acciones/nueva', '/apices/nuevo'])('un visitante en %s termina en «/» con la presentación', async (destino) => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    const antes = window.history.length;
    mostrar(destino, VISITANTE);
    await waitFor(() => expect(ruta()).toBe('/'));
    expect(h1Presentacion()).not.toBeNull();
    expect(hayMapa()).toBe(false);
    // Reemplaza la entrada del historial: no suma una.
    expect(window.history.length).toBe(antes);
  });

  it('una persona con sesión en «/» ve el mapa y no la presentación', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar('/', PERSONA);
    expect(hayMapa()).toBe(true);
    expect(h1Presentacion()).toBeNull();
  });

  it('una cuenta suspendida ve el mapa como antes', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar('/', SUSPENDIDA);
    expect(hayMapa()).toBe(true);
    expect(h1Presentacion()).toBeNull();
  });

  it('una persona con sesión en /acciones se queda en su ruta', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar('/acciones', PERSONA);
    expect(ruta()).toBe('/acciones');
    expect(h1Presentacion()).toBeNull();
  });

  it('mientras la sesión carga solo hay un main ocupado, sin presentación ni mapa', () => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar('/', CARGANDO);
    const principal = document.querySelector('main[aria-busy="true"]');
    expect(principal).not.toBeNull();
    expect(principal!.childElementCount).toBe(0);
    expect(h1Presentacion()).toBeNull();
    expect(hayMapa()).toBe(false);
    expect(document.querySelector('.presentacion')).toBeNull();
  });

  it.each([
    ['/documentacion', /Qué es APICCA/],
    ['/entrar', /Entrar/],
    ['/solicitar', /Solicitar/],
  ])('la página de texto %s no cambia para un visitante', async (destino, titulo) => {
    vi.stubEnv('VITE_PRESENTACION', '1');
    mostrar(destino, VISITANTE);
    expect(ruta()).toBe(destino);
    expect(h1Presentacion()).toBeNull();
    expect(hayMapa()).toBe(false);
    expect(document.querySelector('.presentacion')).toBeNull();
    expect(document.querySelector('.site-header')).not.toBeNull();
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 }).some((h1) => titulo.test(h1.textContent ?? ''))).toBe(true));
  });
});

describe('compuerta de la presentación · apagada', () => {
  it.each([['sin la variable', undefined], ['con VITE_PRESENTACION=0', '0']])('%s, el visitante ve el mapa como antes', (_nombre, valor) => {
    vi.stubEnv('VITE_PRESENTACION', valor ?? '');
    mostrar('/', VISITANTE);
    expect(hayMapa()).toBe(true);
    expect(h1Presentacion()).toBeNull();
  });

  it('con VITE_PRESENTACION=0 en el modo production, el visitante en /acciones ve el mapa y se queda en su ruta', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_PRESENTACION', '0');
    mostrar('/acciones', VISITANTE);
    expect(ruta()).toBe('/acciones');
    expect(h1Presentacion()).toBeNull();
  });

  it('sin la variable en el modo production, el visitante ve la presentación', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_PRESENTACION', '');
    mostrar('/', VISITANTE);
    expect(h1Presentacion()).not.toBeNull();
    expect(hayMapa()).toBe(false);
  });
});
