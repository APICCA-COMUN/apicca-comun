// RF-2 (002) · 2.1, D-T20 (002): las hojas solo usan colores de tokens. Se admiten `var(--…)`,
// `transparent`, `currentColor` y, dentro de `@media (forced-colors: active)`, los colores del sistema.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

/** Hojas revisadas: todas las de `src` (también `src/map/pin.css`), salvo `tokens.css`, que es la fuente generada. */
const LATER = ['src/styles/tokens.css'];
const SHEETS = (readdirSync(resolve(root, 'src'), { recursive: true }) as string[])
  .map((name) => `src/${name.split(sep).join('/')}`)
  .filter((name) => name.endsWith('.css') && !LATER.includes(name));

const NAMED = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod
darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon
darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey
dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey
honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral
lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue
lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise
mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered
orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
yellowgreen`.split(/\s+/);

const SYSTEM = `accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext
graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext`.split(/\s+/);

const FUNCTIONS = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /#[0-9a-f]{3,8}\b/i;

/** Quita comentarios y separa lo que está dentro de `@media (forced-colors: active)` del resto. */
function split(css: string): { forced: string; rest: string } {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let forced = '';
  let rest = '';
  let i = 0;
  const marker = /@media\s*\(\s*forced-colors\s*:\s*active\s*\)\s*\{/g;
  for (let match = marker.exec(text); match; match = marker.exec(text)) {
    rest += text.slice(i, match.index);
    let depth = 1;
    let j = match.index + match[0].length;
    while (depth > 0 && j < text.length) {
      if (text[j] === '{') depth++;
      if (text[j] === '}') depth--;
      j++;
    }
    forced += text.slice(match.index, j);
    i = j;
    marker.lastIndex = j;
  }
  return { forced, rest: rest + text.slice(i) };
}

/** Los valores de las declaraciones de un fragmento de CSS. */
const values = (css: string): string[] =>
  [...css.matchAll(/[\w-]+\s*:\s*([^;{}]+)/g)].map((match) => match[1]!.replace(/url\([^)]*\)/g, '').replace(/var\(--[\w-]+\)/g, ''));

/** Los colores literales de un valor; `system` dice si se admiten los del sistema. */
function literals(value: string, system: boolean): string[] {
  const found: string[] = [];
  if (HEX.test(value)) found.push(value.match(HEX)![0]);
  if (FUNCTIONS.test(value)) found.push(value.match(FUNCTIONS)![0]);
  for (const word of value.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (NAMED.includes(word) || (!system && SYSTEM.includes(word))) found.push(word);
  }
  return found;
}

function literalColors(css: string): string[] {
  const { forced, rest } = split(css);
  return [...values(rest).flatMap((value) => literals(value, false)), ...values(forced).flatMap((value) => literals(value, true))];
}

describe('sin colores literales en las hojas', () => {
  it('RF-2 (002) · 2.1: hay hojas que revisar y ninguna escribe un color a mano', () => {
    expect(SHEETS).toContain('src/styles/base.css');
    expect(SHEETS).toContain('src/styles/blocks.css');
    expect(SHEETS).toContain('src/components/PixelImage.css');
    expect(SHEETS).toContain('src/map/pin.css');
    for (const sheet of SHEETS) expect(literalColors(readFileSync(resolve(root, sheet), 'utf8')), sheet).toEqual([]);
  });

  it('RF-2 (002) · 2.1: el detector encuentra hex, funciones, nombres y colores del sistema fuera de forced-colors', () => {
    expect(literalColors('.a { color: #000; }')).toEqual(['#000']);
    expect(literalColors('.a { background: rgb(0 0 0 / .5); }')).toEqual(['rgb(']);
    expect(literalColors('.a { border: 1px solid red; }')).toEqual(['red']);
    expect(literalColors('.a { outline-color: Highlight; }')).toEqual(['highlight']);
  });

  it('RF-2 (002) · 2.1: admite tokens, transparent, currentColor, clases con nombre de color y el sistema en forced-colors', () => {
    expect(literalColors('.a { color: var(--text); border: 1px solid currentColor; background: transparent; }')).toEqual([]);
    expect(literalColors('.logo__layer--logo-red { fill: var(--logo-red); }')).toEqual([]);
    expect(literalColors('@media (forced-colors: active) { .a { outline-color: Highlight; } .b { fill: CanvasText; } }')).toEqual([]);
    expect(literalColors('.a { background: url(/brand/red.png); }')).toEqual([]);
  });
});
