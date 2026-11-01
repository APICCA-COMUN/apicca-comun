// Pares obligatorios de §4.0 como datos con su umbral (RF-2 (002) · 2.2, RF-1 (002) · 1.5, D-T3 (002), RF-2 (003) · 2.4, RF-5 (003) · 5.1, RF-8 (003) · 8.4, D-T3 (003)).
import { contrastRatio } from './color';
import type { TokenName } from './tokens';

export type RequiredPair = { readonly fg: TokenName; readonly bg: TokenName; readonly threshold: number };

const AXIS_KEYS = ['agua', 'alimento', 'cobijo', 'energia', 'comunicacion'] as const;

const pairs = (fgs: readonly TokenName[], bgs: readonly TokenName[], threshold: number): RequiredPair[] =>
  fgs.flatMap((fg) => bgs.map((bg) => ({ fg, bg, threshold })));

export const REQUIRED_PAIRS: readonly RequiredPair[] = [
  ...pairs(['text', 'text-muted'], ['surface', 'background'], 4.5),
  ...pairs(['action-blue'], ['surface', 'background'], 4.5),
  ...pairs(['brand-red'], ['surface'], 4.5),
  ...pairs(['on-accent'], ['action-blue', 'brand-red'], 4.5),
  ...pairs(['focus'], ['surface', 'background'], 3),
  ...pairs(AXIS_KEYS.map((k) => `axis-${k}-stroke` as const), ['surface', 'charcoal'], 3),
  ...pairs(['field-border'], ['surface', 'background'], 3),
  ...pairs(['on-charcoal', 'on-charcoal-muted'], ['charcoal'], 4.5),
];

// Los pares que no alcanzan su umbral con los valores de un tema.
export const failingPairs = (theme: Readonly<Record<TokenName, string>>): RequiredPair[] =>
  REQUIRED_PAIRS.filter((p) => contrastRatio(theme[p.fg], theme[p.bg]) < p.threshold);
