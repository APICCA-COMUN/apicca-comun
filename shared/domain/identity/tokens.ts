// Contrato de tokens de §4.0 con los valores de plan §2 bis: único origen de los valores
// de diseño (RNF-4 (002), RF-2 (002), D-T3 (002)); valores de §4.0 (003) según D-T2 (003); `radius-lot` de D-T1 (005); tokens y escala de la 008 según D-T1 (008) y D-T2 (008). La hoja de estilos se genera desde aquí.

export const THEMES = ['light', 'dark'] as const;
export type ThemeName = (typeof THEMES)[number];

const light = {
  background: '#E8E7EC',
  line: '#D8D7DE',
  surface: '#FFFDF8',
  text: '#26282C',
  'text-muted': '#57524A',
  charcoal: '#33363B',
  'on-charcoal': '#F3EFE6',
  'on-charcoal-muted': '#C4BDB0',
  // Fondo del pie (RF-5 (008), RF-1 (008) · 1.1).
  'footer-bg': '#33363B',
  'brand-red': '#C8102E',
  'action-blue': '#005FB8',
  'on-accent': '#FFFFFF',
  'field-border': '#7A7368',
  focus: '#005FB8',
  'logo-gray': '#666666',
  'logo-red': '#FF0000',
  'logo-blue': '#0096FF',
  'axis-agua-fill': '#3CC8BA',
  'axis-agua-stroke': '#1A9E92',
  'axis-alimento-fill': '#7CC254',
  'axis-alimento-stroke': '#4E9A2E',
  'axis-cobijo-fill': '#E07B53',
  'axis-cobijo-stroke': '#D06A43',
  'axis-energia-fill': '#F4C542',
  'axis-energia-stroke': '#A88300',
  'axis-comunicacion-fill': '#9B7BD8',
  'axis-comunicacion-stroke': '#9A72DA',
  'radius-block': '14px',
  // Radio de los lotes (RF-2 (005), D-T1 (005)).
  'radius-lot': '18px',
  // Radio del edificio y de las esquinas superiores de los campos (RF-2 (008)).
  'radius-building': '10px',
  'shadow-block': '10px 10px 0 rgb(20 33 61 / .13)',
  'shadow-raised': '18px 18px 0 rgb(20 33 61 / .13)',
  'duration-raise': '150ms',
  // Medidas de la 008: control de 48, botón de ícono de 44, foco a 3 y columna de 1200 (RF-1 (008)).
  'size-control': '48px',
  'size-icon-control': '44px',
  'focus-offset': '3px',
  'content-max': '1200px',
} as const;

export type TokenName = keyof typeof light;

const dark: Record<TokenName, string> = {
  background: '#14213D',
  line: '#2A3A5E',
  surface: '#1F2B47',
  text: '#F3EFE6',
  'text-muted': '#C4BDB0',
  charcoal: '#33363B',
  'on-charcoal': '#F3EFE6',
  'on-charcoal-muted': '#C4BDB0',
  'footer-bg': '#0E1830',
  'brand-red': '#FF8A80',
  'action-blue': '#7CB8FF',
  'on-accent': '#14213D',
  'field-border': '#8E97AD',
  focus: '#FFD166',
  'logo-gray': '#FFFFFF',
  'logo-red': '#FF0000',
  'logo-blue': '#0096FF',
  'axis-agua-fill': '#2BB3A6',
  'axis-agua-stroke': '#1A9E92',
  'axis-alimento-fill': '#6DB04A',
  'axis-alimento-stroke': '#4E9A2E',
  'axis-cobijo-fill': '#D06A43',
  'axis-cobijo-stroke': '#D06A43',
  'axis-energia-fill': '#E8B730',
  'axis-energia-stroke': '#A88300',
  'axis-comunicacion-fill': '#8D6BD0',
  'axis-comunicacion-stroke': '#9A72DA',
  'radius-block': '14px',
  // Radio de los lotes (RF-2 (005), D-T1 (005)).
  'radius-lot': '18px',
  // Radio del edificio y de las esquinas superiores de los campos (RF-2 (008)).
  'radius-building': '10px',
  'shadow-block': '10px 10px 0 rgb(0 0 0 / .32)',
  'shadow-raised': '18px 18px 0 rgb(0 0 0 / .32)',
  'duration-raise': '150ms',
  'size-control': '48px',
  'size-icon-control': '44px',
  'focus-offset': '3px',
  'content-max': '1200px',
};

export const TOKENS: Readonly<Record<ThemeName, Readonly<Record<TokenName, string>>>> = { light, dark };

/** Escala de texto del sistema de diseño (RF-1 (008) · 1.2, D-T2 (008)): igual en los dos temas. */
export const TYPE_SCALE = {
  display: { size: '48px', line: '1.1', weight: '800' },
  numeral: { size: '34px', line: '1', weight: '800' },
  heading: { size: '28px', line: '1.2', weight: '800' },
  'doc-heading': { size: '24px', line: '1.25', weight: '800' },
  title: { size: '22px', line: '1.2', weight: '800' },
  subheading: { size: '20px', line: '1.25', weight: '700' },
  lead: { size: '18px', line: '1.5', weight: '400' },
  body: { size: '16px', line: '1.5', weight: '400' },
  label: { size: '15px', line: '1.5', weight: '700' },
  meta: { size: '14px', line: '1.5', weight: '400' },
} as const;

export const TOKEN_NAMES = Object.keys(light) as readonly TokenName[];

// Tintado de las teselas del mapa (D-T8 (002)); no es token público de §4.0. Con
// `forced-colors: active` no se aplica ninguno.
export const MAP_TINT: Readonly<Record<ThemeName, string>> = {
  light: 'sepia(.25) saturate(.7)',
  dark: 'invert(1) hue-rotate(180deg) brightness(.85) saturate(.5)',
};
