import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider } from './session';
import { SiteNav } from '../components/SiteNav';
import { Link, matchPattern, matchRoute, navigate, normalizePath, useRoute } from './router';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('router: tabla de rutas', () => {
  it('la raíz resuelve la página de inicio', () => {
    expect(matchRoute('/')).toEqual({ page: 'home', params: {}, path: '/' });
  });

  it('una ruta desconocida da la página no encontrada', () => {
    expect(matchRoute('/no-existe').page).toBe('notFound');
  });

  it('la barra final no cambia la ruta', () => {
    expect(normalizePath('/a/')).toBe('/a');
    expect(normalizePath('///')).toBe('/');
    expect(matchRoute('/')).toEqual(matchRoute(''));
  });

  it('un patrón con parámetro lo extrae y decodifica', () => {
    expect(matchPattern('/apices/:id', '/apices/agua%201')).toEqual({ id: 'agua 1' });
    expect(matchPattern('/apices/:id', '/apices')).toBeNull();
    expect(matchPattern('/apices/:id', '/otro/x')).toBeNull();
  });
});

describe('router: rutas nuevas de la 003', () => {
  it.each([
    ['/prototipado', 'prototyping'],
    ['/tablero', 'dashboard'],
    ['/documentacion', 'documentation'],
    ['/constitucion', 'constitution'],
  ])('RF-18 (003) · RF-11 (003) · RF-14 (003) · RF-15 (003) · D-T10 (003): %s resuelve %s', (path, page) => {
    expect(matchRoute(path)).toEqual({ page, params: {}, path });
  });

  it('RF-14 (003) · D-T10 (003): /documentacion/:articulo resuelve documentation con el artículo', () => {
    expect(matchRoute('/documentacion/como-empezar')).toEqual({
      page: 'documentation',
      params: { articulo: 'como-empezar' },
      path: '/documentacion/como-empezar',
    });
  });
});

describe('router: useRoute y navigate', () => {
  it('useRoute sigue a navigate', () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current.page).toBe('home');
    act(() => navigate('/nada#seccion'));
    expect(result.current.page).toBe('notFound');
    expect(result.current.hash).toBe('seccion');
  });

  it('navigate con replace no añade entrada al historial', () => {
    const before = window.history.length;
    navigate('/otra', { replace: true });
    expect(window.history.length).toBe(before);
    expect(window.location.pathname).toBe('/otra');
  });

  it('Link navega con clic simple sin recargar', async () => {
    render(<Link href="/destino">ir</Link>);
    await userEvent.click(screen.getByRole('link', { name: 'ir' }));
    expect(window.location.pathname).toBe('/destino');
  });
});

describe('router: rutas de la constitución común (004)', () => {
  it.each([
    ['/constitucion/historial', 'constitutionHistory', {}],
    ['/constitucion/secciones/s1', 'constitutionSection', { id: 's1' }],
    ['/constitucion/documentos/d1', 'constitutionDocument', { id: 'd1' }],
    ['/constitucion/propuestas', 'amendments', {}],
    ['/constitucion/propuestas/a1', 'amendmentDetail', { id: 'a1' }],
  ])('RF-7 (004) · 7.3: %s resuelve %s', (path, page, params) => {
    expect(matchRoute(path)).toEqual({ page, params, path });
  });

  it('RF-7 (004) · 7.4: /constitucion/propuestas no se confunde con :id y /constitucion sigue siendo la página principal', () => {
    expect(matchRoute('/constitucion/propuestas').params).toEqual({});
    expect(matchRoute('/constitucion/propuestas').page).toBe('amendments');
    expect(matchRoute('/constitucion').page).toBe('constitution');
    expect(matchRoute('/constitucion/otra').page).toBe('notFound');
  });

  it.each([
    '/constitucion/historial',
    '/constitucion/secciones/s1',
    '/constitucion/documentos/d1',
    '/constitucion/propuestas',
    '/constitucion/propuestas/a1',
  ])('RF-7 (004) · 7.4: el menú marca «Constitución» como actual en %s', (path) => {
    window.history.replaceState(null, '', path);
    render(
      <SessionProvider initial={{ status: 'visitor' }}>
        <SiteNav />
      </SessionProvider>,
    );
    expect(screen.getByRole('link', { name: 'Constitución' }).getAttribute('aria-current')).toBe('page');
  });
});
