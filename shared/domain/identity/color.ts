// Color puro: contraste WCAG (RF-2 (002)) y distancia perceptual CIEDE2000 (RF-4 (002)).
// Implementado a mano, sin dependencias de color, según D-T4 (002).

export type Rgb = [number, number, number]
export type Lab = [number, number, number]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Convierte `#RRGGBB` a canales 0–255. Lanza un Error si el formato no es válido. */
export function hexToRgb(hex: string): Rgb {
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) {
    throw new Error(`Color hex inválido: se esperaba #RRGGBB y llegó «${String(hex)}».`)
  }
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** Canal sRGB 0–255 a lineal 0–1 (umbral 0.04045). */
function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Luminancia relativa WCAG 2.x de un color `#RRGGBB`. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linearize) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razón de contraste WCAG 2.x entre dos colores (entre 1 y 21, simétrica). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// Blanco de referencia D65 (escala 0–1 en Y).
const WHITE_D65: Rgb = [0.95047, 1, 1.08883]

/** sRGB `#RRGGBB` a CIELAB (D65). */
function hexToLab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex).map(linearize) as Rgb
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b
  const eps = 216 / 24389
  const kappa = 24389 / 27
  const f = (t: number) => (t > eps ? Math.cbrt(t) : (kappa * t + 16) / 116)
  const fx = f(x / WHITE_D65[0])
  const fy = f(y / WHITE_D65[1])
  const fz = f(z / WHITE_D65[2])
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Matiz en grados [0, 360); 0 cuando a y b son 0. */
function hueDeg(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0
  const h = toDeg(Math.atan2(b, ap))
  return h >= 0 ? h : h + 360
}

/** CIEDE2000 (kL = kC = kH = 1) directamente sobre dos colores Lab. */
export function deltaE2000Lab(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))))

  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h1p = hueDeg(b1, a1p)
  const h2p = hueDeg(b2, a2p)

  const dLp = L2 - L1
  const dCp = C2p - C1p

  // Δh' y h̄' con el caso C1'·C2' = 0 y el salto de 180°.
  let dhp: number
  let hbarp: number
  if (C1p * C2p === 0) {
    dhp = 0
    hbarp = h1p + h2p
  } else {
    const diff = h2p - h1p
    if (Math.abs(diff) <= 180) {
      dhp = diff
      hbarp = (h1p + h2p) / 2
    } else {
      dhp = diff > 180 ? diff - 360 : diff + 360
      hbarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
    }
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(toRad(dhp / 2))

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  const T =
    1 -
    0.17 * Math.cos(toRad(hbarp - 30)) +
    0.24 * Math.cos(toRad(2 * hbarp)) +
    0.32 * Math.cos(toRad(3 * hbarp + 6)) -
    0.2 * Math.cos(toRad(4 * hbarp - 63))

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2))
  const Cbarp7 = Math.pow(Cbarp, 7)
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)))
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2))
  const Sc = 1 + 0.045 * Cbarp
  const Sh = 1 + 0.015 * Cbarp * T
  const Rt = -Math.sin(toRad(2 * dTheta)) * Rc

  const l = dLp / Sl
  const c = dCp / Sc
  const h = dHp / Sh
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h)
}

/** CIEDE2000 entre dos colores `#RRGGBB` (sRGB → XYZ D65 → CIELAB). */
export function deltaE2000(a: string, b: string): number {
  return deltaE2000Lab(hexToLab(a), hexToLab(b))
}
