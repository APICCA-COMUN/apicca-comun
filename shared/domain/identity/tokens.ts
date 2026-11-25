// Contrato de tokens de §4.0, hoy con los valores del sistema «APICCA · Mapa» (ver abajo) con los valores de plan §2 bis: único origen de los valores
// de diseño (RNF-4 (002), RF-2 (002), D-T3 (002)); valores de §4.0 (003) según D-T2 (003); `radius-lot` de D-T1 (005); tokens y escala de la 008 según D-T1 (008) y D-T2 (008); `radius-pill`, `node-ring`, `veil` y la escala fluida de D-T2 (019) y D-T3 (019); la paleta del terreno de D-T24 (019). La hoja de estilos se genera desde aquí.

export const THEMES = ['light', 'dark'] as const;
export type ThemeName = (typeof THEMES)[number];

// Paleta «E3 · Celda» (24-11-2026) sobre el sistema «APICCA · Mapa» (23-11-2026, https://claude.ai/artifact/QEdX1nvqa6nqKbyzzpDyfU): papel y tinta, cinco
// colores de eje planos, radio 0 y sin sombras. Los nombres de siempre se conservan y toman los valores del sistema;
// los nuevos (`trama`, `ruta`, `contorno-superficie`, `glifo-sobre-eje` y los trazos) vienen de su `tokens.json`.
// Lo que no sale del sistema (acción principal y destructiva en tinta) es propuesta del asistente.
const light = {
  // papel
  background: '#FFFFFF',
  // trama: celdas vacías del teselado y divisores, solo decoración (1,5:1)
  line: '#D3D3D3',
  surface: '#FFFFFF',
  // tinta
  text: '#141414',
  // suave: texto secundario, solo sobre papel (5,74:1)
  'text-muted': '#666666',
  charcoal: '#141414',
  'on-charcoal': '#FFFFFF',
  'on-charcoal-muted': '#D3D3D3',
  'footer-bg': '#141414',
  // Lo destructivo y el error van en tinta; los distingue la palabra y la forma, no el color.
  'brand-red': '#141414',
  // La acción principal es tinta llena con texto en papel.
  'action-blue': '#141414',
  'on-accent': '#FFFFFF',
  'field-border': '#141414',
  focus: '#141414',
  'node-ring': '#141414',
  // Velo detrás de un diálogo abierto; lleva transparencia.
  veil: 'rgb(20 20 20 / .55)',
  'logo-gray': '#666666',
  'logo-red': '#FF0000',
  'logo-blue': '#0096FF',
  // Ejes: fondos de superficie, nunca color de texto; el glifo va siempre en `glifo-sobre-eje` (4,61:1 a 12,69:1).
  'axis-agua-fill': '#0096FF',
  'axis-agua-stroke': '#141414',
  'axis-alimento-fill': '#47C254',
  'axis-alimento-stroke': '#141414',
  'axis-cobijo-fill': '#FF8F00',
  'axis-cobijo-stroke': '#141414',
  'axis-energia-fill': '#FFD200',
  'axis-energia-stroke': '#141414',
  'axis-comunicacion-fill': '#FF0000',
  'axis-comunicacion-stroke': '#141414',
  trama: '#D3D3D3',
  // Celda de una Acción Común: el glifo del eje va encima en su color (4,61:1 a 12,69:1 en claro).
  ruta: '#141414',
  // Contorno de 2 px de toda superficie de patrón: los ejes dan 1,45:1 a 4:1 sobre el papel claro.
  'contorno-superficie': '#141414',
  'glifo-sobre-eje': '#141414',
  // Radio 0 en todo.
  'radius-block': '0px',
  'radius-lot': '0px',
  'radius-building': '0px',
  'radius-pill': '0px',
  // Sin sombras.
  'shadow-block': 'none',
  'shadow-raised': 'none',
  'duration-raise': '150ms',
  'size-control': '48px',
  'size-icon-control': '44px',
  'focus-offset': '3px',
  'content-max': '1200px',
  // Trazos del sistema: borde de controles y fichas, borde de zona, contorno de superficie, divisor y foco.
  'stroke-border': '3px',
  'stroke-zone': '4px',
  'stroke-outline': '2px',
  'stroke-divider': '1.5px',
  'focus-width': '3px',
} as const;

export type TokenName = keyof typeof light;

const dark: Record<TokenName, string> = {
  background: '#121212',
  line: '#343434',
  surface: '#121212',
  text: '#FFFFFF',
  'text-muted': '#B4B4B4',
  charcoal: '#FFFFFF',
  'on-charcoal': '#121212',
  'on-charcoal-muted': '#343434',
  'footer-bg': '#FFFFFF',
  'brand-red': '#FFFFFF',
  'action-blue': '#FFFFFF',
  'on-accent': '#121212',
  'field-border': '#FFFFFF',
  focus: '#FFFFFF',
  'node-ring': '#FFFFFF',
  veil: 'rgb(0 0 0 / .65)',
  'logo-gray': '#FFFFFF',
  'logo-red': '#FF0000',
  'logo-blue': '#0096FF',
  'axis-agua-fill': '#0096FF',
  'axis-agua-stroke': '#141414',
  'axis-alimento-fill': '#47C254',
  'axis-alimento-stroke': '#141414',
  'axis-cobijo-fill': '#FF8F00',
  'axis-cobijo-stroke': '#141414',
  'axis-energia-fill': '#FFD200',
  'axis-energia-stroke': '#141414',
  'axis-comunicacion-fill': '#FF0000',
  'axis-comunicacion-stroke': '#141414',
  trama: '#343434',
  // En oscuro la ruta no es tinta (sería clara): gris para que los glifos de eje se lean (3,11:1 a 8,58:1).
  ruta: '#343434',
  'contorno-superficie': '#FFFFFF',
  'glifo-sobre-eje': '#141414',
  'radius-block': '0px',
  'radius-lot': '0px',
  'radius-building': '0px',
  'radius-pill': '0px',
  'shadow-block': 'none',
  'shadow-raised': 'none',
  'duration-raise': '150ms',
  'size-control': '48px',
  'size-icon-control': '44px',
  'focus-offset': '3px',
  'content-max': '1200px',
  'stroke-border': '3px',
  'stroke-zone': '4px',
  'stroke-outline': '2px',
  'stroke-divider': '1.5px',
  'focus-width': '3px',
};

export const TOKENS: Readonly<Record<ThemeName, Readonly<Record<TokenName, string>>>> = { light, dark };

/**
 * Escala de texto del sistema de diseño (RF-1 (008) · 1.2, D-T2 (008)): igual en los dos temas.
 * `display` (h1 y cierre del Inicio) y `heading` (h2 de sección) son fluidos; su máximo no pasa de 2,5 veces el
 * mínimo, para cumplir WCAG 1.4.4 con el zoom del navegador (RF-2 (019), D-T3 (019)).
 */
export const TYPE_SCALE = {
  // titulo-sistema (38) en pantalla ancha
  display: { size: 'clamp(28px, 4vw, 38px)', line: '1.05', weight: '800' },
  numeral: { size: '34px', line: '1', weight: '800' },
  // titulo-pantalla (27)
  heading: { size: 'clamp(22px, 3vw, 27px)', line: '1.1', weight: '800' },
  'doc-heading': { size: '22px', line: '1.15', weight: '800' },
  // titulo-ficha (20)
  title: { size: '20px', line: '1.1', weight: '800' },
  // titulo-lista (18)
  subheading: { size: '18px', line: '1.2', weight: '800' },
  // cuerpo (19)
  lead: { size: '19px', line: '1.4', weight: '400' },
  body: { size: '16px', line: '1.5', weight: '400' },
  // botón primario (17): «el primario usa el mismo estilo a 17 px» (tokens.json del sistema)
  'label-primary': { size: '17px', line: '1.2', weight: '800' },
  // rotulo-campo y botón (15)
  label: { size: '15px', line: '1.2', weight: '800' },
  // dato (14)
  meta: { size: '14px', line: '1.3', weight: '400' },
} as const;

export const TOKEN_NAMES = Object.keys(light) as readonly TokenName[];

// Tintado de las teselas del mapa (D-T8 (002)); no es token público de §4.0. Con
// `forced-colors: active` no se aplica ninguno.
export const MAP_TINT: Readonly<Record<ThemeName, string>> = {
  light: 'sepia(.25) saturate(.7)',
  dark: 'invert(1) hue-rotate(180deg) brightness(.85) saturate(.5)',
};
