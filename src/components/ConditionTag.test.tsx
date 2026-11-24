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

  it('RF-6 (003) · 6.1, QA #21.2: la etiqueta es solo su texto, sin punto decorativo (D-T20 (003))', () => {
    render(<ConditionTag condition="archived">Archivado</ConditionTag>);
    const tag = screen.getByText('Archivado');
    expect(tag.querySelector('.tag-dot')).toBeNull();
    expect(tag.childElementCount).toBe(0);
    expect(tag.textContent).toBe('Archivado');
    expect(tag.getAttribute('style')).toBeNull();
  });
});
