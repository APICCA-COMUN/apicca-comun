import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { openIndex } from './tests/browser/commands';
import { seedFull, seedPartial } from './tests/browser/seed';
import { testTiles } from './tests/browser/test-tiles/plugin';

// Cuatro proyectos: `unit-node` y `unit-dom` corren con `npm test`; `emu` solo dentro de
// `firebase emulators:exec` (script `test:emu`), y `browser`, en Chromium, con `test:browser`
// (D-T12 (002), D-T13 (002)).
const ignored = ['**/node_modules/**', '**/dist/**', '**/dist-browser/**', '**/dist-browser-par/**', '**/lib/**'];

export default defineConfig({
  plugins: [react()],
  test: {
    // Mientras no haya pruebas contra emuladores, `test:emu` no debe fallar por vacío.
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-node',
          environment: 'node',
          include: [
            'shared/**/*.test.ts',
            'src/**/*.test.ts',
            'scripts/**/*.test.ts',
            'functions/src/**/*.test.ts',
            'functions/scripts/**/*.test.ts',
            'tests/tooling/**/*.test.ts',
            'tests/perf/**/*.test.ts',
          ],
          exclude: [...ignored, '**/*.emu.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-dom',
          environment: 'jsdom',
          setupFiles: ['src/testing/setup-dom.ts'],
          include: ['src/**/*.test.tsx'],
          exclude: [...ignored, '**/*.browser.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'emu',
          environment: 'node',
          // Los archivos comparten el emulador (mismo projectId) y cada uno lo limpia
          // en `beforeEach`: en paralelo se pisarían los datos sembrados.
          fileParallelism: false,
          // Las pruebas de transacciones simultáneas esperan el bloqueo del emulador y
          // reintentan: con la máquina cargada pasan de los 5 s por defecto.
          testTimeout: 20_000,
          include: ['**/*.emu.test.ts', 'tests/rules/**/*.test.ts', 'tests/storage/**/*.test.ts'],
          exclude: ignored,
        },
      },
      {
        extends: true,
        // El marco de pruebas sirve la tesela local de `VITE_TILE_URL` (D-T13 (002)).
        plugins: [testTiles()],
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.browser.test.tsx'],
          exclude: ignored,
          // Las mismas variables con las que `test:browser` compila `dist-browser/`.
          env: { VITE_USE_EMULATORS: 'true', VITE_TILE_URL: '/test-tiles/tile.png', VITE_EMULATOR_LANE: process.env['VITE_EMULATOR_LANE'] ?? '' },
          globalSetup: ['tests/browser/global-setup.ts'],
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            // `__screenshots__/` guarda solo las referencias aprobadas (T-8.2, T-8.4); los diferenciales van a
            // `.vitest-attachments/`. Tolerancia de D-T12 (002): umbral por píxel de 0,1 y como mucho 0,1 % de
            // píxeles distintos.
            screenshotFailures: false,
            expect: {
              toMatchScreenshot: {
                comparatorName: 'pixelmatch',
                comparatorOptions: { threshold: 0.1, allowedMismatchedPixelRatio: 0.001 },
              },
            },
            commands: { openIndex, seedFull, seedPartial },
          },
        },
      },
    ],
  },
});
