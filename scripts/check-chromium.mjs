#!/usr/bin/env node
// Comprueba que Playwright tiene Chromium antes de compilar y correr las pruebas de
// navegador (plan 002 §9.4). Sin él, Vitest fallaría con un error largo en inglés.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const path = chromium.executablePath();
if (!existsSync(path)) {
  console.error(
    'Falta Chromium para las pruebas de navegador. Instálalo una vez con:\n\n  npx playwright install chromium\n',
  );
  process.exit(1);
}
