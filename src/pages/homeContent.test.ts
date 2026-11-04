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

  it('RF-16 (019) · 16.1, D-7 (019), D-T10 (019): el paso 2 es «Proponer un ápice» y el 3 promete el historial, no una hebra', () => {
    expect(HOME_CONTENT.steps[1].title).toBe('Proponer un ápice');
    expect(HOME_CONTENT.steps[2].text).toBe('Se hace entre varias y queda en el historial.');
    for (const step of HOME_CONTENT.steps) expect(`${step.title} ${step.text}`, step.title).not.toMatch(/Acción Común|hebra/);
  });

  it('RF-16 (019) · 16.1, D-7 (019), D-T10 (019): ningún paso del contenido real promete algo inexistente sin soon', () => {
    for (const step of HOME_CONTENT.steps) {
      if (step.soon) expect(step.soon).toBe(true);
      expect(`${step.title} ${step.text}`).not.toMatch(/Acción Común|hebra/);
    }
  });
});
