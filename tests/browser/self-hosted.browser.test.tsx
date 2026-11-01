// RNF-3 (002), D-T6 (002), D-T11 (002): la fuente, el logo y los íconos salen del propio sitio. La fuente se pide por
// una ruta del mismo origen y el logo y los íconos son SVG en línea, sin `<img>` ni peticiones externas.
import '../../src/styles/fonts.css';
import '../../src/styles/tokens.css';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { AXES } from '../../shared/domain/apice';
import { AxisIcon } from '../../src/components/AxisIcon';
import { Logo } from '../../src/components/Logo';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  // El texto en Nunito obliga al navegador a pedir el archivo de la fuente.
  host.style.fontFamily = 'Nunito';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root.unmount();
  host.remove();
});

/** Peticiones de fuentes e imágenes que hizo la página hasta ahora. */
function mediaRequests(): PerformanceResourceTiming[] {
  return (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
    (entry) => entry.initiatorType === 'img' || /\.(woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico)(\?|#|$)/i.test(entry.name),
  );
}

describe('recursos propios (navegador)', () => {
  it('RNF-3 (002): toda petición de fuente o imagen es del mismo origen y se pide la woff2 de Nunito', async () => {
    root.render(
      <>
        <Logo />
        {AXES.map((axis) => (
          <AxisIcon key={axis} axis={axis} labelled />
        ))}
        <p>Nunito: áéíóú ñ ¿qué?</p>
      </>,
    );
    await expect.poll(() => host.querySelectorAll('svg').length).toBeGreaterThan(AXES.length);
    await document.fonts.load('16px Nunito');
    await document.fonts.ready;

    const requests = mediaRequests();
    expect(requests.some((entry) => /nunito[^/]*\.woff2(\?|$)/i.test(new URL(entry.name).pathname))).toBe(true);
    const foreign = requests.filter((entry) => new URL(entry.name).origin !== location.origin).map((entry) => entry.name);
    expect(foreign).toEqual([]);
  });

  it('RNF-3 (002): el logo y los íconos de los cinco ejes son SVG en línea, sin <img> ni <use> externos', async () => {
    root.render(
      <>
        <Logo />
        {AXES.map((axis) => (
          <AxisIcon key={axis} axis={axis} labelled />
        ))}
      </>,
    );
    await expect.poll(() => host.querySelectorAll('svg').length).toBeGreaterThanOrEqual(AXES.length + 1);
    expect(host.querySelectorAll('img, object, embed, iframe')).toHaveLength(0);
    for (const use of host.querySelectorAll('use')) expect(use.getAttribute('href') ?? '').toMatch(/^#|^$/);
    expect(host.querySelector('svg.logo, .logo svg')).not.toBeNull();
    expect(host.querySelectorAll('svg.axis-icon')).toHaveLength(AXES.length);
    for (const svg of host.querySelectorAll('svg')) expect(svg.querySelector('path')).not.toBeNull();
  });
});
