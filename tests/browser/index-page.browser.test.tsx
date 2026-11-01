// El comando que abre el `index.html` del build aparte del marco de pruebas (D-T13 (002)).
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { FIXED_TIME } from './fixed-time';

describe('comando openIndex', () => {
  it('RNF-6 (002): abre el build de vista previa con la hora fija', async () => {
    const page = await commands.openIndex();
    expect(page.title).toBe('APICCA COMÚN');
    expect(page.now).toBe(Date.parse(FIXED_TIME));
  });
});
