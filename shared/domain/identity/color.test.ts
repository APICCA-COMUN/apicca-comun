// Pruebas de color: contraste WCAG (RF-2 (002)) y distancia perceptual CIEDE2000 (RF-4 (002)).
// Cubre D-T4 (002): dominio puro, sin dependencias de color externas.
import { describe, expect, it } from 'vitest'
import { contrastRatio, deltaE2000, deltaE2000Lab, relativeLuminance } from './color'

type Lab = [number, number, number]

// Datos de prueba de Sharma, Wu y Dalal (2005), Tabla 1: [lab1, lab2, ΔE00 esperado].
const SHARMA: Array<[Lab, Lab, number]> = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, -1, 2], [50, 0, 0], 2.3669],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.001], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
  [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
  [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
  [[50, -0.001, 2.49], [50, 0.001, -2.49], 4.8045],
  [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [61, -5, 29], 22.8977],
  [[50, 2.5, 0], [56, -27, -3], 31.903],
  [[50, 2.5, 0], [58, 24, 15], 19.4535],
  [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
  [[50, 2.5, 0], [50, 3.2972, 0], 1.0],
  [[50, 2.5, 0], [50, 1.8634, 0.5757], 1.0],
  [[50, 2.5, 0], [50, 3.2592, 0.335], 1.0],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
  [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
  [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
]

describe('contraste WCAG', () => {
  it('RF-2 (002) · 2.2: negro sobre blanco da 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10)
  })

  it('RF-2 (002) · 2.2: un color consigo mismo da 1 y la razón es simétrica', () => {
    expect(contrastRatio('#3CC8BA', '#3cc8ba')).toBeCloseTo(1, 10)
    expect(contrastRatio('#0096FF', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#0096FF'), 10)
  })

  it('RF-2 (002) · 2.2: #0096FF sobre #FFFFFF da 3,09 (±0,01)', () => {
    expect(Math.abs(contrastRatio('#0096FF', '#FFFFFF') - 3.09)).toBeLessThan(0.01)
  })

  it('RF-2 (002) · 2.2: la luminancia del negro es 0 y la del blanco es 1', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
  })

  it('RF-2 (002) · 2.2: lanza un Error con un formato que no es #RRGGBB', () => {
    expect(() => relativeLuminance('#FFF')).toThrow(Error)
    expect(() => contrastRatio('rojo', '#FFFFFF')).toThrow(/hex/i)
  })
})

describe('CIEDE2000', () => {
  it.each(SHARMA.map((fila, i) => [i + 1, ...fila] as const))(
    'RF-4 (002) · 4.4: par %i de Sharma coincide con ΔE00 esperado',
    (_n, lab1, lab2, expected) => {
      const got = deltaE2000Lab(lab1, lab2)
      expect(Math.abs(got - expected)).toBeLessThan(1e-4)
    },
  )

  it('RF-4 (002) · 4.4: son 34 pares', () => {
    expect(SHARMA).toHaveLength(34)
  })

  it('RF-4 (002) · 4.4: un color hex contra sí mismo da 0', () => {
    expect(deltaE2000('#3CC8BA', '#3CC8BA')).toBe(0)
  })

  it('RF-4 (002) · 4.4: la versión hex es simétrica y positiva entre colores distintos', () => {
    const ab = deltaE2000('#3CC8BA', '#FF4040')
    expect(ab).toBeGreaterThan(0)
    expect(ab).toBeCloseTo(deltaE2000('#FF4040', '#3CC8BA'), 10)
  })
})
