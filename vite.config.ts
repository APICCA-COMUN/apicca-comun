import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { testTiles } from './tests/browser/test-tiles/plugin.ts';

// Solo el build de pruebas (`--mode browser`, a `dist-browser/`) publica la tesela local (D-T13 (002)).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'browser' ? [react(), testTiles()] : [react()],
}));
