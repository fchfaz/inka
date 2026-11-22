import { describe, it, expect } from 'vitest';
import { renderTemplate, getGeneratedCardOrds, BUILTIN_NOTE_TYPES } from './template';

describe('Template Renderer', () => {
  it('renders Basic note type', () => {
    const basic = BUILTIN_NOTE_TYPES.find((t) => t.id === 'builtin-basic')!;
    const fields = { Front: 'Hello', Back: 'World' };
    const res = renderTemplate(basic.templates[0], fields, 0);
    expect(res.question).toBe('Hello');
    expect(res.answer).toContain('Hello');
    expect(res.answer).toContain('World');
  });

  it('renders Basic (optional reversed) note type', () => {
    const optRev = BUILTIN_NOTE_TYPES.find((t) => t.id === 'builtin-basic-opt-reversed')!;
    const fieldsWithout = { Front: 'Apple', Back: 'Apel', 'Add Reverse': '' };
    const ordsWithout = getGeneratedCardOrds(optRev, fieldsWithout);
    expect(ordsWithout).toEqual([0]);

    const fieldsWith = { Front: 'Apple', Back: 'Apel', 'Add Reverse': 'y' };
    const ordsWith = getGeneratedCardOrds(optRev, fieldsWith);
    expect(ordsWith).toEqual([0, 1]);

    const resRev = renderTemplate(optRev.templates[1], fieldsWith, 1);
    expect(resRev.question).toBe('Apel');
    expect(resRev.answer).toContain('Apple');
  });

  it('renders Cloze deletion note type', () => {
    const cloze = BUILTIN_NOTE_TYPES.find((t) => t.id === 'builtin-cloze')!;
    const fields = { Text: 'Canberra is the {{c1::capital}} of {{c2::Australia}}.', Extra: 'Geography fact' };
    const ords = getGeneratedCardOrds(cloze, fields);
    expect(ords).toEqual([0, 1]);

    const c1 = renderTemplate(cloze.templates[0], fields, 0, true);
    expect(c1.question).toContain('[…]');
    expect(c1.question).toContain('Australia');
    expect(c1.answer).toContain('<b>capital</b>');
    expect(c1.answer).toContain('Geography fact');

    const c2 = renderTemplate(cloze.templates[0], fields, 1, true);
    expect(c2.question).toContain('capital');
    expect(c2.question).toContain('[…]');
    expect(c2.answer).toContain('<b>Australia</b>');
  });
});
