import { describe, expect, it } from 'vitest';
import { AXES } from '../../shared/domain/apice';
import { HOME_CONTENT } from './homeContent';

describe('HOME_CONTENT', () => {
  it('RF-10 (003) · 10.8, D-21 (003): trae una frase no vacía por cada eje de AXES', () => {
    for (const axis of AXES) expect(HOME_CONTENT.axes[axis].trim(), axis).not.toBe('');
    expect(Object.keys(HOME_CONTENT.axes).sort()).toEqual([...AXES].sort());
  });

  it('RF-10 (003) · 10.8, D-21 (003): trae tres pasos no vacíos', () => {
    expect(HOME_CONTENT.steps).toHaveLength(3);
    for (const step of HOME_CONTENT.steps) {
      expect(step.title.trim()).not.toBe('');
      expect(step.text.trim()).not.toBe('');
    }
  });
});
