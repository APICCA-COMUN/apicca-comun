// Tamaños de letra y ampliación al 200 % en el build real (RF-5 (002) · 5.5 a 5.7, plan §9.4), también en las rutas
// de la 003 (RF-16 (003) · 16.2, 16.3; RF-17 (003) · 17.2). `/tablero` no entra: estas páginas se abren sobre el
// build de `dist-browser`, que nunca usa los emuladores (`shouldUseEmulators` exige DEV), así que no hay sesión.
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

const PAGES: { path: string }[] = [
  { path: '/' },
  { path: '/entrar' },
  { path: '/prototipado' },
  { path: '/documentacion' },
  { path: '/constitucion' },
];

/** Opciones de `openIndex` para la ruta. */
const open = ({ path }: (typeof PAGES)[number]) => ({ path, audit: true });

describe.each(PAGES)('tamaños de letra en $path', (route) => {
  it('RF-5 (002) · 5.6: ningún texto mide menos de 14 px, salvo la atribución del mapa', async () => {
    const page = await commands.openIndex(open(route));
    expect(page.audit!.texts).toBeGreaterThan(0);
    expect(page.audit!.smallText).toEqual([]);
  });

  it('RF-5 (002) · 5.5: párrafos y campos miden al menos 16 px', async () => {
    const page = await commands.openIndex(open(route));
    expect(page.audit!.smallFields).toEqual([]);
  });

  it('RF-5 (002) · 5.7: al 200 % (640 × 400) no hay texto recortado ni controles inalcanzables', async () => {
    const page = await commands.openIndex({ ...open(route), viewport: { width: 640, height: 400 } });
    expect(page.audit!.controls).toBeGreaterThan(0);
    expect(page.audit!.clipped).toEqual([]);
    expect(page.audit!.unreachable).toEqual([]);
  });
});
