import type { NoteType, CardTemplate } from '../types/models';
import { renderCloze } from './anki/convert';


export const BUILTIN_NOTE_TYPES: NoteType[] = [
  {
    id: 'builtin-basic',
    name: 'Basic',
    fields: [{ name: 'Front' }, { name: 'Back' }],
    templates: [
      {
        name: 'Card 1',
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
      },
    ],
  },
  {
    id: 'builtin-basic-reversed',
    name: 'Basic (and reversed card)',
    fields: [{ name: 'Front' }, { name: 'Back' }],
    templates: [
      {
        name: 'Card 1',
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
      },
      {
        name: 'Card 2',
        qfmt: '{{Back}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}',
      },
    ],
  },
  {
    id: 'builtin-basic-opt-reversed',
    name: 'Basic (optional reversed card)',
    fields: [{ name: 'Front' }, { name: 'Back' }, { name: 'Add Reverse' }],
    templates: [
      {
        name: 'Card 1',
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
      },
      {
        name: 'Card 2',
        qfmt: '{{#Add Reverse}}{{Back}}{{/Add Reverse}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}',
      },
    ],
  },
  {
    id: 'builtin-cloze',
    name: 'Cloze',
    isCloze: true,
    fields: [{ name: 'Text' }, { name: 'Extra' }],
    templates: [
      {
        name: 'Cloze 1',
        qfmt: '{{cloze:Text}}',
        afmt: '{{cloze:Text}}\n\n<hr id=answer>\n\n{{Extra}}',
      },
    ],
  },
  {
    id: 'builtin-japanese-vocab',
    name: 'Japanese Vocab',
    fields: [
      { name: 'Front' },
      { name: 'Back' },
      { name: 'Meaning' },
      { name: 'Example_JP' },
      { name: 'Example_Hiragana' },
      { name: 'Example_ID' },
      { name: 'Hint' },
      { name: 'Extra' },
    ],
    templates: [
      {
        name: 'Recognition',
        qfmt: '{{Front}}{{#Hint}}<br><span class="hint">💡 {{Hint}}</span>{{/Hint}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{#Back}}<div class="reading">{{Back}}</div>{{/Back}}{{#Meaning}}<div class="meaning">{{Meaning}}</div>{{/Meaning}}{{#Example_JP}}<div class="example"><div class="ex-jp">{{Example_JP}}</div>{{#Example_Hiragana}}<div class="ex-reading">{{Example_Hiragana}}</div>{{/Example_Hiragana}}{{#Example_ID}}<div class="ex-id">{{Example_ID}}</div>{{/Example_ID}}</div>{{/Example_JP}}{{#Extra}}<div class="extra">{{Extra}}</div>{{/Extra}}',
      },
    ],
  },
];

export interface RenderResult {
  question: string;
  answer: string;
}


export function renderTemplate(
  template: CardTemplate,
  fields: Record<string, string>,
  cardOrd: number = 0,
  isCloze: boolean = false
): RenderResult {
  
  const renderConditionals = (tmpl: string): string => {
    
    let res = tmpl.replace(/\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key: string, content: string) => {
      const val = (fields[key.trim()] || fields[key.trim().toLowerCase()] || '').trim();
      return val ? content : '';
    });
    
    res = res.replace(/\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key: string, content: string) => {
      const val = (fields[key.trim()] || fields[key.trim().toLowerCase()] || '').trim();
      return !val ? content : '';
    });
    return res;
  };

  const replaceFields = (tmpl: string, currentOrd: number): string => {
    let out = renderConditionals(tmpl);
    
    out = out.replace(/\{\{cloze:([^}]+)\}\}/g, (_m, fieldName: string) => {
      const raw = fields[fieldName.trim()] || fields[fieldName.trim().toLowerCase()] || '';
      return renderCloze(raw, currentOrd + 1).question;
    });

    
    out = out.replace(/\{\{([^}#^/]+)\}\}/g, (m, key: string) => {
      const trimmed = key.trim();
      if (trimmed === 'FrontSide') return m; 
      
      const val = fields[trimmed] ?? fields[trimmed.toLowerCase()] ?? '';
      return val;
    });
    return out;
  };

  let q = replaceFields(template.qfmt, cardOrd);

  
  if (isCloze && !template.qfmt.includes('cloze:')) {
    
    q = renderCloze(q, cardOrd + 1).question;
  }

  
  let a = template.afmt;
  
  a = a.replace(/\{\{FrontSide\}\}/g, q);

  if (isCloze) {
    
    a = renderConditionals(a);
    a = a.replace(/\{\{cloze:([^}]+)\}\}/g, (_m, fieldName: string) => {
      const raw = fields[fieldName.trim()] || fields[fieldName.trim().toLowerCase()] || '';
      return renderCloze(raw, cardOrd + 1).answer;
    });
    
    a = a.replace(/\{\{([^}#^/]+)\}\}/g, (_m, key: string) => {
      const trimmed = key.trim();
      if (trimmed === 'FrontSide') return '';
      return fields[trimmed] ?? fields[trimmed.toLowerCase()] ?? '';
    });
    
    a = renderCloze(a, cardOrd + 1).answer;
  } else {
    a = replaceFields(a, cardOrd);
  }

  return { question: q.trim(), answer: a.trim() };
}


export function getGeneratedCardOrds(noteType: NoteType, fields: Record<string, string>): number[] {
  if (noteType.isCloze) {
    
    let maxCloze = 0;
    const re = /\{\{c(\d+)::/g;
    for (const val of Object.values(fields)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(val)) !== null) {
        const num = parseInt(m[1], 10);
        if (num > maxCloze) maxCloze = num;
      }
    }
    const ords: number[] = [];
    for (let i = 0; i < maxCloze; i++) {
      ords.push(i);
    }
    return ords.length > 0 ? ords : [0];
  }

  const ords: number[] = [];
  for (let i = 0; i < noteType.templates.length; i++) {
    const tmpl = noteType.templates[i];
    const rendered = renderTemplate(tmpl, fields, i, false);
    
    if (rendered.question.trim().length > 0) {
      ords.push(i);
    }
  }
  return ords;
}
