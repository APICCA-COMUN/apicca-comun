// RNF-6 (002): lo que `index.html` ofrece antes de que cargue JavaScript (plan §5).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');

describe('index.html sin JavaScript', () => {
  it('RNF-6 (002): un <noscript> en el <body> dice en español que el sitio necesita JavaScript', () => {
    const body = html.slice(html.indexOf('<body>'));
    const match = /<noscript>([\s\S]*?)<\/noscript>/.exec(body);
    expect(match).not.toBeNull();
    const text = match![1]!.replace(/<[^>]+>/g, ' ');
    expect(text).toMatch(/necesita JavaScript/);
    expect(text).toMatch(/actív/i);
  });
});
