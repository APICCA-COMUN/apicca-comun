// El comando que abre el `index.html` del build aparte del marco de pruebas (D-T13 (002)).
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { FIXED_TIME } from './fixed-time';

describe('comando openIndex', () => {
  it('RNF-6 (002): abre el build de vista previa con la hora fija', async () => {
    const page = await commands.openIndex();
    // RF-11 (021): `/` es el mapa, y su título, «Jugar» (plan 021 §4).
    expect(page.title).toBe('Jugar · APICCA COMÚN');
    expect(page.now).toBe(Date.parse(FIXED_TIME));
  });
});
