import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConditionTag } from './ConditionTag';

describe('ConditionTag', () => {
  it('RF-13 (002) · 13.1, 13.2: la condición es una etiqueta con su texto, sin depender del color', () => {
    render(<ConditionTag condition="visibility">Privado</ConditionTag>);
    const tag = screen.getByText('Privado');
    expect(tag.classList.contains('tag')).toBe(true);
    expect(tag.dataset['condition']).toBe('visibility');
    expect(tag.getAttribute('style')).toBeNull();
    expect(tag.textContent).toBe('Privado');
  });

  it('RF-6 (003) · 6.1: la etiqueta es un punto decorativo seguido de su texto (D-T20 (003))', () => {
    render(<ConditionTag condition="archived">Archivado</ConditionTag>);
    const tag = screen.getByText('Archivado');
    const dot = tag.firstElementChild as HTMLElement | null;
    expect(dot).not.toBeNull();
    expect(dot?.classList.contains('tag-dot')).toBe(true);
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.textContent).toBe('');
    expect(tag.lastChild?.textContent).toBe('Archivado');
    expect(tag.getAttribute('style')).toBeNull();
  });
});
