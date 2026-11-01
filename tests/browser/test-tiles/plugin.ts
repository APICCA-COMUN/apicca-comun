// D-T13 (002): publica la tesela local en `/test-tiles/tile.png`, solo para las pruebas de navegador.
// `vite.config.ts` la activa únicamente con `--mode browser` (el build de `dist-browser/`) y el
// proyecto `browser` de Vitest la sirve al marco; un build normal a `dist/` nunca la incluye.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const PATH = '/test-tiles/tile.png';
const FILE = resolve(import.meta.dirname, 'tile.png');

export function testTiles(): Plugin {
  return {
    name: 'apicca-test-tiles',
    configureServer(server) {
      server.middlewares.use(PATH, (_request, response) => {
        response.setHeader('Content-Type', 'image/png');
        response.end(readFileSync(FILE));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: PATH.slice(1), source: readFileSync(FILE) });
    },
  };
}
