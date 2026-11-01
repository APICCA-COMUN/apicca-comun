import { describe, expect, it } from 'vitest';
import {
  PALETTE,
  PIXEL_SIZE,
  PROPOSAL_TTL_MS,
  isProposalExpired,
  proposalWarnings,
  quantizeToPalette,
  type ProposalSnapshot,
} from './images';

const HOUR = 3600 * 1000;

describe('paleta y cuantización', () => {
  it('RF-17 (001): la imagen pixelada es de 64 × 64 con una paleta de 16 colores distintos', () => {
    expect(PIXEL_SIZE).toBe(64);
    expect(PALETTE).toHaveLength(16);
    expect(new Set(PALETTE.map((c) => c.join(','))).size).toBe(16);
    for (const color of PALETTE) {
      expect(color).toHaveLength(3);
      for (const channel of color) expect(Number.isInteger(channel) && channel >= 0 && channel <= 255).toBe(true);
    }
  });

  it('RF-17 (001): toda salida de quantizeToPalette usa solo colores de la paleta y conserva el tamaño', () => {
    const rgb = new Uint8Array(PIXEL_SIZE * PIXEL_SIZE * 3);
    for (let i = 0; i < rgb.length; i += 1) rgb[i] = (i * 37 + (i >> 3) * 11) % 256;
    const out = quantizeToPalette(rgb);
    expect(out).toHaveLength(PIXEL_SIZE * PIXEL_SIZE * 3);
    const allowed = new Set(PALETTE.map((c) => c.join(',')));
    for (let i = 0; i < out.length; i += 3) expect(allowed.has(`${out[i]},${out[i + 1]},${out[i + 2]}`)).toBe(true);
  });

  it('RF-17 (001): un color de la paleta no cambia', () => {
    const rgb = Uint8Array.from(PALETTE.flatMap((c) => [...c]));
    expect([...quantizeToPalette(rgb)]).toEqual([...rgb]);
  });

  it('RF-17 (001): un color cercano va al color más cercano de la paleta', () => {
    const [r, g, b] = PALETTE[5] as readonly [number, number, number];
    const near = Uint8Array.from([Math.min(255, r + 2), Math.max(0, g - 2), b]);
    expect([...quantizeToPalette(near)]).toEqual([r, g, b]);
  });

  it('RF-17 (001): rechaza un búfer cuya longitud no es múltiplo de 3', () => {
    expect(() => quantizeToPalette(new Uint8Array(4))).toThrow();
  });
});

describe('caducidad y avisos de la propuesta', () => {
  const created = new Date('2026-10-07T12:00:00Z');

  it('RF-17 (001): la propuesta caduca a las 24 h, no antes', () => {
    expect(PROPOSAL_TTL_MS).toBe(24 * HOUR);
    expect(isProposalExpired(created, new Date(created.getTime() + 23 * HOUR))).toBe(false);
    expect(isProposalExpired(created, new Date(created.getTime() + 24 * HOUR))).toBe(true);
    expect(isProposalExpired(created, new Date(created.getTime() + 25 * HOUR))).toBe(true);
  });

  const snapshot: ProposalSnapshot = { version: 3, imageId: 'img1', referenceIds: ['r1', 'r2'] };
  const current = { version: 3, imageId: 'img1', activeReferenceIds: ['r1', 'r2', 'r3'] };

  it('RF-18 (001): sin cambios no hay avisos', () => {
    expect(proposalWarnings(snapshot, current)).toEqual([]);
  });

  it('RF-18 (001): cambió el contenido', () => {
    expect(proposalWarnings(snapshot, { ...current, version: 4 })).toEqual(['content-changed']);
  });

  it('RF-18 (001): cambió la imagen del ápice, también de ninguna a una', () => {
    expect(proposalWarnings(snapshot, { ...current, imageId: 'img2' })).toEqual(['image-changed']);
    expect(proposalWarnings({ ...snapshot, imageId: null }, { ...current, imageId: 'img2' })).toEqual(['image-changed']);
    expect(proposalWarnings(snapshot, { ...current, imageId: null })).toEqual(['image-changed']);
  });

  it('RF-16 (001): usó una referencia que ya se quitó', () => {
    expect(proposalWarnings(snapshot, { ...current, activeReferenceIds: ['r1', 'r3'] })).toEqual(['reference-removed']);
  });

  it('RF-18 (001): reúne varios avisos en un orden estable', () => {
    expect(proposalWarnings(snapshot, { version: 9, imageId: 'x', activeReferenceIds: [] })).toEqual([
      'content-changed',
      'image-changed',
      'reference-removed',
    ]);
  });
});
