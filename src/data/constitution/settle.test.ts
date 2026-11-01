// T-9.6 · Llamar a settleAmendments antes de leer, solo con cuenta activa.
import { describe, expect, it, vi } from 'vitest';
import { settleThenRead } from './settle';

describe('settle.ts', () => {
  it('RF-12 (004) · 12.5: llama a settleAmendments antes de leer', async () => {
    const order: string[] = [];
    const settle = vi.fn(async () => void order.push('settle'));
    const read = vi.fn(() => {
      order.push('read');
      return 'vigente';
    });
    const result = await settleThenRead({ active: true, settle, read });
    expect(order).toEqual(['settle', 'read']);
    expect(result).toEqual({ settled: true, value: 'vigente' });
    expect(settle).toHaveBeenCalledWith({});
  });

  it('RF-12 (004) · 12.5: con id, la llamada se limita a esa propuesta', async () => {
    const settle = vi.fn(async () => undefined);
    await settleThenRead({ active: true, id: 'a1', settle, read: () => 1 });
    expect(settle).toHaveBeenCalledWith({ id: 'a1' });
  });

  it('RF-12 (004) · 12.5: un visitante o una cuenta sin sesión activa no llama y lee igual', async () => {
    const settle = vi.fn(async () => undefined);
    const result = await settleThenRead({ active: false, settle, read: () => 'público' });
    expect(settle).not.toHaveBeenCalled();
    expect(result).toEqual({ settled: false, value: 'público' });
  });

  it('RF-12 (004) · 12.5: si la llamada falla, lee lo que haya y lo avisa con settled: false', async () => {
    const settle = vi.fn(async () => {
      throw new Error('sin red');
    });
    const result = await settleThenRead({ active: true, settle, read: async () => 'último' });
    expect(result).toEqual({ settled: false, value: 'último' });
  });
});
